import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import {
  requireAuth,
  requireRole,
  AuthRequest,
} from "../../middleware/auth";

const router = Router();

router.use(requireAuth);

/**
 * Safely get a single string from Express params/query values.
 *
 * Express can type these values as:
 * string | string[]
 *
 * We only want a plain string.
 */
function getStringParam(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}


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

// ============================================================
// GET /challans?status=&page=&limit=
// ============================================================
router.get("/", async (req, res) => {
  try {
    const status = getStringParam(req.query.status);
    const pageParam = getStringParam(req.query.page);
    const limitParam = getStringParam(req.query.limit);

    const page = pageParam
      ? parseInt(pageParam, 10) || 1
      : 1;

    const limit = limitParam
      ? parseInt(limitParam, 10) || 20
      : 20;

    const where = status
      ? {
          status: status as any,
        }
      : {};

    const [challans, total] = await Promise.all([
      prisma.challan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          customer: true,
          items: true,
        },
      }),

      prisma.challan.count({
        where,
      }),
    ]);

    return res.json({
      data: challans,
      page,
      limit,
      total,
    });
  } catch (error) {
    console.error("Error fetching challans:", error);

    return res.status(500).json({
      error: "Failed to fetch challans",
    });
  }
});

// ============================================================
// GET /challans/:id
// ============================================================
router.get("/:id", async (req, res) => {
  try {
    const challanId = getStringParam(req.params.id);

    if (!challanId) {
      return res.status(400).json({
        error: "Invalid challan id",
      });
    }

    const challan = await prisma.challan.findUnique({
      where: {
        id: challanId,
      },
      include: {
        customer: true,
        items: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!challan) {
      return res.status(404).json({
        error: "Challan not found",
      });
    }

    return res.json(challan);
  } catch (error) {
    console.error("Error fetching challan:", error);

    return res.status(500).json({
      error: "Failed to fetch challan",
    });
  }
});

// ============================================================
// POST /challans
// Create challan as DRAFT
// ============================================================
router.post(
  "/",
  requireRole("ADMIN", "SALES"),
  async (req: AuthRequest, res) => {
    try {
      const parsed = createChallanSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.flatten(),
        });
      }

      const { customerId, items } = parsed.data;

      // Check customer exists
      const customer = await prisma.customer.findUnique({
        where: {
          id: customerId,
        },
      });

      if (!customer) {
        return res.status(404).json({
          error: "Customer not found",
        });
      }

      // Get all product IDs
      const productIds = items.map(
        (item) => item.productId
      );

      // Fetch products
      const products = await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
      });

      // Check all products exist
      if (products.length !== productIds.length) {
        return res.status(404).json({
          error: "One or more products not found",
        });
      }

      const challanNumber =
        await generateChallanNumber();

      const totalQuantity = items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      const challan = await prisma.challan.create({
        data: {
          challanNumber,
          customerId,
          status: "DRAFT",
          totalQuantity,
          createdById: req.user!.userId,

          items: {
            create: items.map((item) => {
              const product = products.find(
                (p) => p.id === item.productId
              );

              if (!product) {
                throw new Error(
                  `Product not found: ${item.productId}`
                );
              }

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

        include: {
          items: true,
          customer: true,
        },
      });

      return res.status(201).json(challan);
    } catch (error) {
      console.error("Error creating challan:", error);

      return res.status(500).json({
        error: "Failed to create challan",
      });
    }
  }
);

// ============================================================
// POST /challans/:id/confirm
// ============================================================
router.post(
  "/:id/confirm",
  requireRole("ADMIN", "SALES"),
  async (req: AuthRequest, res) => {
    try {
      const challanId = getStringParam(req.params.id);

      if (!challanId) {
        return res.status(400).json({
          error: "Invalid challan id",
        });
      }

      // IMPORTANT:
      // Include items because we use challan.items below.
      const challan =
        await prisma.challan.findUnique({
          where: {
            id: challanId,
          },
          include: {
            items: true,
          },
        });

      if (!challan) {
        return res.status(404).json({
          error: "Challan not found",
        });
      }

      if (challan.status !== "DRAFT") {
        return res.status(400).json({
          error: `Challan is already ${challan.status}, cannot confirm`,
        });
      }

      // Get product IDs from challan items
      const productIds = challan.items.map(
        (item) => item.productId
      );

      const products = await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
      });

      // Check stock before making any changes
      for (const item of challan.items) {
        const product = products.find(
          (p) => p.id === item.productId
        );

        if (
          !product ||
          product.currentStock < item.quantity
        ) {
          return res.status(400).json({
            error: `Insufficient stock for ${item.productName}. Available: ${
              product?.currentStock ?? 0
            }, required: ${item.quantity}`,
          });
        }
      }

      // All checks passed.
      // Deduct stock + create movement + confirm challan atomically.
      const operations = [
        prisma.challan.update({
          where: {
            id: challanId,
          },
          data: {
            status: "CONFIRMED",
          },
        }),

        ...challan.items.flatMap((item) => [
          prisma.product.update({
            where: {
              id: item.productId,
            },
            data: {
              currentStock: {
                decrement: item.quantity,
              },
            },
          }),

          prisma.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              movementType: "OUT",
              reason: `Challan ${challan.challanNumber}`,
              createdById: req.user!.userId,
            },
          }),
        ]),
      ];

      const result =
        await prisma.$transaction(operations);

      const updatedChallan = result[0];

      return res.json(updatedChallan);
    } catch (error) {
      console.error(
        "Error confirming challan:",
        error
      );

      return res.status(500).json({
        error: "Failed to confirm challan",
      });
    }
  }
);

// ============================================================
// POST /challans/:id/cancel
// ============================================================
router.post(
  "/:id/cancel",
  requireRole("ADMIN", "SALES"),
  async (req, res) => {
    try {
      const challanId = getStringParam(req.params.id);

      if (!challanId) {
        return res.status(400).json({
          error: "Invalid challan id",
        });
      }

      const challan =
        await prisma.challan.findUnique({
          where: {
            id: challanId,
          },
        });

      if (!challan) {
        return res.status(404).json({
          error: "Challan not found",
        });
      }

      if (challan.status === "CONFIRMED") {
        return res.status(400).json({
          error: "Cannot cancel a confirmed challan",
        });
      }

      const updated =
        await prisma.challan.update({
          where: {
            id: challanId,
          },
          data: {
            status: "CANCELLED",
          },
        });

      return res.json(updated);
    } catch (error) {
      console.error(
        "Error cancelling challan:",
        error
      );

      return res.status(500).json({
        error: "Failed to cancel challan",
      });
    }
  }
);

export default router;
