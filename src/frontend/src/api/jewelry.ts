import { http } from "./http";
import type { JewelryItemForCard } from "../types/JewelryItemForCard";
import type { JewelryItemDetail } from "../types/JewelryItemDetail";
import type { CreateJewelryItemRequest } from "../types/JewelryItemAdmin";

export async function getCatalog(): Promise<JewelryItemForCard[]> {
    const res = await http.get<JewelryItemForCard[]>("/api/jewelryItem");
    return res.data;
}

export async function getCategories(): Promise<string[]> {
    const res = await http.get<string[]>("/api/jewelryItem/categories");
    return res.data;
}

export async function getCollections(): Promise<string[]> {
    const res = await http.get<string[]>("/api/jewelryItem/collections");
    return res.data;
}

// NEW: Get item details by ID
export async function getJewelryItemById(id: number): Promise<JewelryItemDetail> {
    const res = await http.get<JewelryItemDetail>(`/api/jewelryItem/${id}`);
    return res.data;
}

export async function addJewelryItem(data: CreateJewelryItemRequest) {
    const res = await http.post("/api/jewelryItem", data);
    return res.data;
}

export async function updateJewelryItem(id: number, data: CreateJewelryItemRequest) {
    await http.put("/api/jewelryItem", data, { params: { id } });
}

export async function deleteJewelryItem(id: number) {
    await http.delete("/api/jewelryItem", { params: { id } });
}