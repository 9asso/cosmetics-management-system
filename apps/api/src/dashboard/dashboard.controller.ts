import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { Roles } from "../auth/auth.decorators.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  summary() {
    return this.dashboard.summary();
  }

  @Get("analytics")
  analytics(
    @Query(
      new ZodValidationPipe(
        z.object({ range: z.enum(["year", "month", "week"]).default("year") }),
      ),
    )
    query: {
      range: "year" | "month" | "week";
    },
  ) {
    return this.dashboard.analytics(query.range);
  }

  @Get("report")
  @Roles("OWNER", "MANAGER", "ACCOUNTANT")
  report(
    @Query(
      new ZodValidationPipe(
        z
          .object({ dateFrom: z.iso.date(), dateTo: z.iso.date() })
          .refine(
            (value) => value.dateFrom <= value.dateTo,
            "La date de début doit précéder la date de fin.",
          ),
      ),
    )
    query: {
      dateFrom: string;
      dateTo: string;
    },
  ) {
    return this.dashboard.report(query.dateFrom, query.dateTo);
  }
}
