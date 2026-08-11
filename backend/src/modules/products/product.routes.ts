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
  const id = String(req.params.id);
  const challan = await prisma.challan.findUnique({
    where: { id },
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
            productSku: product.sku,
            unitPrice: product.unitPrice,
            quantity: item.quantity,
          };
        }),
      },
    },
    include: { items: true, customer: true },
  });
 
  res.status(201).json(challan);
});
 
// POST /challans/:id/confirm — the critical business logic
router.post("/:id/confirm", requireRole("ADMIN", "SALES"), async (req: AuthRequest, res) => {
  const challanId: string = String(req.params.id);
 
  const challan = await prisma.challan.findUnique({
    where: { id: challanId },
    include: { items: true },
  });
  if (!challan) return res.status(404).json({ error: "Challan not found" });
  if (challan.status !== "DRAFT") {
    return res.status(400).json({ error: `Challan is already ${challan.status}, cannot confirm` });
  }
 
  // Check stock sufficiency for every item BEFORE making any changes
  const productIds = challan.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
 
  for (const item of challan.items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product || product.currentStock < item.quantity) {
      return res.status(400).json({
        error: `Insufficient stock for ${item.productName}. Available: ${product?.currentStock ?? 0}, required: ${item.quantity}`,
      });
    }
  }
 
  // All checks passed — perform deduction + movement logging + status update atomically
  const operations = [
    prisma.challan.update({ where: { id: challanId }, data: { status: "CONFIRMED" as const } }),
    ...challan.items.flatMap((item) => [
      prisma.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      }),
      prisma.stockMovement.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          movementType: "OUT" as const,
          reason: `Challan ${challan.challanNumber}`,
          createdById: req.user!.userId,
        },
      }),
    ]),
  ];
 
  await prisma.$transaction(operations);
 
  const updatedChallan = await prisma.challan.findUnique({
    where: { id: challanId },
    include: { items: true, customer: true },
  });
 
  res.json(updatedChallan);
});
 
// POST /challans/:id/cancel
router.post("/:id/cancel", requireRole("ADMIN", "SALES"), async (req, res) => {
  const id = String(req.params.id);
  const challan = await prisma.challan.findUnique({ where: { id } });
  if (!challan) return res.status(404).json({ error: "Challan not found" });
  if (challan.status === "CONFIRMED") {
    return res.status(400).json({ error: "Cannot cancel a confirmed challan" });
  }
  const updated = await prisma.challan.update({
    where: { id },
    data: { status: "CANCELLED" as const },
  });
  res.json(updated);
});
 
export default router;
 