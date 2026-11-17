import * as productService from "../services/product.services.js";
import { parseBody } from "../validators/parseBody.js";
import { createProductSchema, updateProductSchema } from "../validators/product.schemas.js";

// Public

export async function listActive(req, res) {
    const products = await productService.listActive();
    res.json(products);
}

export async function getById(req, res) {
    const product = await productService.getById(req.params.id);
    res.json(product);
}

export async function getStock(req, res) {
    const stock = await productService.getStock(req.params.id);
    res.json(stock);
}

// Admin

export async function listAll(req, res) {
    const products = await productService.listAll();
    res.json(products);
}

export async function create(req, res) {
    const body = parseBody(createProductSchema, req, res);
    if (!body) return;

    const product = await productService.create(body);
    res.status(201).json(product);
}

export async function update(req, res) {
    const body = parseBody(updateProductSchema, req, res);
    if (!body) return;

    const product = await productService.update(req.params.id, body);
    res.json(product);
}

export async function deactivate(req, res) {
    await productService.deactivate(req.params.id);
    res.status(204).end();
}

export async function loadStock(req, res) {
    const result = await productService.loadStock(req.params.id);
    res.json(result);
}
