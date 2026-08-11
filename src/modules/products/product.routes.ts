import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";

const router = Router();
router.use(requireAuth);

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().optional(),
  unitPrice: z.number().positive(),
  currentStock: z.number().int().min(0).optional(),
  minStockAlert: z.number().int().min(0).optional(),
  location: z.string().optional(),
});

// GET /products?search=&page=&limit=
router.get("/", async (req, res) => {
  const search = (req.query.search as string) || "";
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.product.count({ where }),
  ]);

  res.json({ data: products, page, limit, total });
});

// GET /products/:id
router.get("/:id", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: (req.params.id as string) } });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// POST /products
router.post("/", requireRole("ADMIN", "WAREHOUSE"), async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  try {
    const product = await prisma.product.create({ data: parsed.data });
    res.status(201).json(product);
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "SKU already exists" });
    }
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /products/:id
router.put("/:id", requireRole("ADMIN", "WAREHOUSE"), async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  try {
    const product = await prisma.product.update({ where: { id: (req.params.id as string) }, data: parsed.data });
    res.json(product);
  } catch {
    res.status(404).json({ error: "Product not found" });
  }
});

// POST /products/:id/stock-movement — manual stock adjustment (IN/OUT)
const movementSchema = z.object({
  quantity: z.number().int().positive(),
  movementType: z.enum(["IN", "OUT"]),
  reason: z.string().optional(),
});

router.post("/:id/stock-movement", requireRole("ADMIN", "WAREHOUSE"), async (req: AuthRequest, res) => {
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const { quantity, movementType, reason } = parsed.data;
  const productId = (req.params.id as string);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  if (movementType === "OUT" && product.currentStock < quantity) {
    return res.status(400).json({ error: "Insufficient stock for this movement" });
  }

  const delta = movementType === "IN" ? quantity : -quantity;

  const [updatedProduct, movement] = await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { currentStock: { increment: delta } },
    }),
    prisma.stockMovement.create({
      data: {
        productId,
        quantity,
        movementType,
        reason,
        createdById: req.user!.userId,
      },
    }),
  ]);

  res.status(201).json({ product: updatedProduct, movement });
});

export default router;