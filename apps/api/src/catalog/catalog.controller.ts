import {
  Body,
  Controller,
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
} from "@cosmetics/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { CatalogService } from "./catalog.service.js";
import { Roles } from "../auth/auth.decorators.js";

@Controller("products")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(productListQuerySchema))
    query: ProductListQuery,
  ) {
    return this.catalog.list(query);
  }

  @Get(":id/lots")
  stockLots(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.catalog.stockLots(id);
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

  @Post()
  @Roles("OWNER", "MANAGER", "WAREHOUSE")
  create(
    @Body(new ZodValidationPipe(createProductSchema)) input: CreateProductInput,
  ) {
    return this.catalog.create(input);
  }
}
