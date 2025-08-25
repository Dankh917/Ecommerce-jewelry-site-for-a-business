import { http } from "./http";
import type { JewelryItem } from "../types/JewelryItemForCard";

export async function getCatalog(): JewelryItemForCard[] {

    const res = await http.get<JewelryItemForCard[]>("/api/jewelryItem");
    return res.data;

}