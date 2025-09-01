import React, { useState, useEffect } from "react";
import JewelryCard from "../components/JewelryCard";
import { getCatalog, getCategories, getCollections } from "../api/jewelry";
import type { JewelryItemForCard } from "../types/JewelryItemForCard";

export default function CatalogPage() {
    const [sortType, setSortType] = useState<"category" | "collection" | "">("");
    const [option, setOption] = useState<string>("");
    const [items, setItems] = useState<JewelryItemForCard[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [collections, setCollections] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [catalog, cats, cols] = await Promise.all([
                    getCatalog(),
                    getCategories(),
                    getCollections()
                ]);
                setItems(catalog);
                setCategories(cats);
                setCollections(cols);
            } catch (e: any) {
                setError(e?.message ?? "Failed to load catalog");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const filteredItems = items.filter(item => {
        if (!sortType || !option) return true;
        if (sortType === "category") return item.category === option;
        if (sortType === "collection") return item.collection === option;
        return true;
    });

    if (loading) return <main className="p-4">Loading…</main>;
    if (error) return <main className="p-4 text-red-600">{error}</main>;
    if (!items.length) return <main className="p-4">No items yet.</main>;

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: "#fbfbfa" }}>
            {/* Header Section */}
            <div className="mb-8 flex flex-col items-center">
                <h1
                    className="text-4xl font-extrabold mb-2 text-center w-full"
                    style={{
                        color: "#bfa16a",
                        textShadow: "0 2px 8px #e9e2d0",
                        letterSpacing: "0.05em",
                    }}
                >
                    Catalog
                </h1>
                <div className="w-16 h-1 rounded bg-[#bfa16a] mb-4"></div>
                <div className="flex gap-2 mt-2">
                    <select
                        className="select select-bordered"
                        value={sortType}
                        onChange={e => {
                            setSortType(e.target.value as "category" | "collection" | "");
                            setOption("");
                        }}
                    >
                        <option value="">Sort by...</option>
                        <option value="category">Category</option>
                        <option value="collection">Collection</option>
                    </select>
                    {sortType && (
                        <select
                            className="select select-bordered"
                            value={option}
                            onChange={e => setOption(e.target.value)}
                        >
                            <option value="">Choose {sortType}...</option>
                            {(sortType === "category" ? categories : collections).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>
            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 max-w-6xl mx-auto">
                {filteredItems.map(item => (
                    <JewelryCard key={item.id} item={item} />
                ))}
            </div>
        </div>
    );
}
