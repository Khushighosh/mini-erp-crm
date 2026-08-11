import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";

const router = Router();
router.use(requireAuth);

const createChallanSchema = z.object({
  customerId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

async function generateChallanNumber(): Promise<string> {
  const count = await prisma.challan.count();
  const next = count + 1;
  return `CH-${String(next).padStart(5, "0")}`;
}

// GET /challans?status=&page=&limit=
router.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const where = status ? { status: status as any } : {};

  const [challans, total] = await Promise.all([
    prisma.challan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { customer: true, items: true },
    }),
    prisma.challan.count({ where }),
  ]);

  res.json({ data: challans, page, limit, total });
});

// GET /challans/:id
router.get("/:id", async (req, res) => {
  const challan = await prisma.challan.findUnique({
    where: { id: (req.params.id as string) },
    include: { customer: true, items: true, createdBy: { select: { name: true, email: true } } },
  });
  if (!challan) return res.status(404).json({ error: "Challan not found" });
  res.json(challan);
});

// POST /challans — create as Draft
router.post("/", requireRole("ADMIN", "SALES"), async (req: AuthRequest, res) => {
  const parsed = createChallanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const { customerId, items } = parsed.data;

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) {
    return res.status(404).json({ error: "One or more products not found" });
  }

  const challanNumber = await generateChallanNumber();
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

  const challan = await prisma.challan.create({
    data: {
      challanNumber,
      customerId,
      status: "DRAFT",
      totalQuantity,
      createdById: req.user!.userId,
      items: {
        create: items.map((item) => {
          const product = products.find((p) => p.id === item.productId)!;
          return {
            productId: product.id,
            productName: product.name,
            productSku: