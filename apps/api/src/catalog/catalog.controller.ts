import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Patch,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  createProductSchema,
  productMediaSchema,
  type ProductMediaInput,
  productListQuerySchema,
  type CreateProductInput,
  type ProductListQuery,
  updateProductSchema,
  type UpdateProductInput,
  updateStockLotSchema,
  type UpdateStockLotInput,
} from "@cosmetics/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { CatalogService } from "./catalog.service.js";
import { CurrentUser, Roles } from "../auth/auth.decorators.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";

@Controller("products")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(productListQuerySchema))
    query: ProductListQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalog.list(query, false, user.role === "SALES_REP");
  }

  @Get(":id/lots")
  stockLots(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalog.stockLots(id, user.role === "SALES_REP");
  }

  @Patch(":productId/lots/:lotId")
  @Roles("OWNER", "MANAGER", "WAREHOUSE")
  updateStockLot(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Param("lotId", new ParseUUIDPipe()) lotId: string,
    @Body(new ZodValidationPipe(updateStockLotSchema))
    input: UpdateStockLotInput,
  ) {
    return this.catalog.updateStockLot(productId, lotId, input);
  }

  @Post("media")
  @Roles("OWNER", "MANAGER", "WAREHOUSE")
  upload(@Body() bytes: Buffer) {
    return this.catalog.uploadMedia(bytes);
  }

  @Patch(":id/media")
  @Roles("OWNER", "MANAGER", "WAREHOUSE")
  updateMedia(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(productMediaSchema)) input: ProductMediaInput,
  ) {
    return this.catalog.updateMedia(id, input);
  }

  @Patch(":id")
  @Roles("OWNER", "MANAGER", "WAREHOUSE")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) input: UpdateProductInput,
  ) {
    return this.catalog.update(id, input);
  }

  @Post()
  @Roles("OWNER", "MANAGER", "WAREHOUSE")
  create(
    @Body(new ZodValidationPipe(createProductSchema)) input: CreateProductInput,
  ) {
    return this.catalog.create(input);
  }

  @Delete(":id")
  @Roles("OWNER")
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.catalog.remove(id);
  }
}
