import { describe, expect, it } from "vitest";
import { rootStackRoutes } from "./rootStackRoutes";

describe("rootStackRoutes", () => {
  it("uses the sales tabs as the default app shell", () => {
    expect(rootStackRoutes[0]).toEqual({
      name: "(drawer)",
      options: { headerShown: false },
    });
  });

  it("retains supplier forms for use from Logistics", () => {
    expect(rootStackRoutes.map((route) => route.name)).toEqual([
      '(drawer)',
      'supplier/new',
      'supplier/[id]',
      'logistics/history',
    ]);
  });
});
