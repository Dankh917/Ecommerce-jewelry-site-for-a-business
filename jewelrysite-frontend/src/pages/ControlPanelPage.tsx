import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { decodeJwtPayload } from "../utils/jwt";
import { extractRoles } from "../utils/roles";
import { addJewelryItem, deleteJewelryItem, getCatalog, getCategories, getCollections } from "../api/jewelry";
import type { JewelryItemForCard } from "../types/JewelryItemForCard";
import type { CreateJewelryItemRequest } from "../types/JewelryItemAdmin";

type Claims = {
    [key: string]: unknown;
};

type GalleryFormRow = {
    url: string;
    sortOrder: string;
};

type FormState = {
    name: string;
    description: string;
    category: string;
    collection: string;
    weightGrams: string;
    color: string;
    sizeCM: string;
    price: string;
    stockQuantity: string;
    isAvailable: boolean;
    mainImageUrl: string;
    galleryImages: GalleryFormRow[];
    videoUrl: string;
    videoPosterUrl: string;
    videoDurationSeconds: string;
    shippingPrice: string;
};

const BRAND_COLOR = "#6B8C8E";
const PANEL_BACKGROUND = "#fbfbfa";
const SECTION_HEADER = "#E3F0F2";

const createInitialFormState = (): FormState => ({
    name: "",
    description: "",
    category: "",
    collection: "",
    weightGrams: "",
    color: "",
    sizeCM: "",
    price: "",
    stockQuantity: "",
    isAvailable: true,
    mainImageUrl: "",
    galleryImages: [{ url: "", sortOrder: "" }],
    videoUrl: "",
    videoPosterUrl: "",
    videoDurationSeconds: "",
    shippingPrice: "",
});

function resolveErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const data = error.response?.data;
        if (typeof data === "string") {
            return data;
        }
        if (data && typeof data === "object") {
            const message = (data as { message?: string }).message;
            if (typeof message === "string") {
                return message;
            }
        }
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "Unexpected error occurred.";
}

export default function ControlPanelPage() {
    const { user, jwtToken } = useAuth();

    const claims = useMemo<Claims | null>(() => {
        if (user) {
            return user as Claims;
        }
        if (jwtToken) {
            return decodeJwtPayload<Claims>(jwtToken);
        }
        return null;
    }, [jwtToken, user]);

    const roles = useMemo(() => extractRoles(claims), [claims]);
    const isAdmin = roles.some(role => role.toLowerCase() === "admin");

    const [formState, setFormState] = useState<FormState>(() => createInitialFormState());
    const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
    const [collectionSuggestions, setCollectionSuggestions] = useState<string[]>([]);
    const [items, setItems] = useState<JewelryItemForCard[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [itemsError, setItemsError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showBanner = useCallback((type: "success" | "error", message: string, duration = 3500) => {
        setBanner({ type, message });
        if (bannerTimeoutRef.current) {
            clearTimeout(bannerTimeoutRef.current);
        }
        if (duration > 0) {
            bannerTimeoutRef.current = setTimeout(() => setBanner(null), duration);
        }
    }, []);

    useEffect(() => {
        return () => {
            if (bannerTimeoutRef.current) {
                clearTimeout(bannerTimeoutRef.current);
            }
        };
    }, []);

    const refreshCatalog = useCallback(async () => {
        setItemsLoading(true);
        setItemsError(null);
        try {
            const data = await getCatalog();
            setItems(data);
        } catch (error) {
            setItemsError(resolveErrorMessage(error));
        } finally {
            setItemsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        refreshCatalog();
    }, [isAdmin, refreshCatalog]);

    useEffect(() => {
        if (!isAdmin) return;
        let active = true;
        (async () => {
            try {
                const [categories, collections] = await Promise.all([
                    getCategories(),
                    getCollections(),
                ]);
                if (!active) return;
                setCategorySuggestions(categories);
                setCollectionSuggestions(collections);
            } catch (error) {
                console.warn("Failed to load category or collection suggestions", error);
            }
        })();
        return () => {
            active = false;
        };
    }, [isAdmin]);

    const updateFormField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
        setFormState(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleGalleryChange = (index: number, field: keyof GalleryFormRow, value: string) => {
        setFormState(prev => {
            const nextRows = prev.galleryImages.map((row, rowIndex) =>
                rowIndex === index ? { ...row, [field]: value } : row
            );
            return { ...prev, galleryImages: nextRows };
        });
    };

    const addGalleryRow = () => {
        setFormState(prev => ({
            ...prev,
            galleryImages: [...prev.galleryImages, { url: "", sortOrder: "" }],
        }));
    };

    const removeGalleryRow = (index: number) => {
        setFormState(prev => {
            const nextRows = prev.galleryImages.filter((_, rowIndex) => rowIndex !== index);
            return {
                ...prev,
                galleryImages: nextRows.length > 0 ? nextRows : [{ url: "", sortOrder: "" }],
            };
        });
    };

    const parseDecimal = (value: string): number | undefined => {
        if (!value.trim()) return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    };

    const parseInteger = (value: string): number | undefined => {
        if (!value.trim()) return undefined;
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : undefined;
    };

    const optionalString = (value: string) => (value.trim() ? value.trim() : undefined);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isAdmin) return;

        if (!formState.name.trim() || !formState.description.trim() || !formState.category.trim()) {
            showBanner("error", "Name, description, and category are required.", 4500);
            return;
        }

        const shippingPriceValue = parseDecimal(formState.shippingPrice);
        if (shippingPriceValue === undefined) {
            showBanner("error", "Please provide a valid shipping price.", 4500);
            return;
        }

        const priceValue = parseDecimal(formState.price);
        const weightValue = parseDecimal(formState.weightGrams);
        const stockValue = parseInteger(formState.stockQuantity);
        const videoDurationValue = parseInteger(formState.videoDurationSeconds);

        const galleryPayload = formState.galleryImages
            .map((row, index) => {
                const url = row.url.trim();
                if (!url) return null;
                const parsedSortOrder = parseInteger(row.sortOrder);
                return {
                    url,
                    sortOrder: parsedSortOrder ?? index,
                };
            })
            .filter((row): row is { url: string; sortOrder: number } => row !== null);

        const payload: CreateJewelryItemRequest = {
            name: formState.name.trim(),
            description: formState.description.trim(),
            category: formState.category.trim(),
            collection: optionalString(formState.collection) ?? null,
            weightGrams: weightValue ?? null,
            color: optionalString(formState.color) ?? null,
            sizeCM: optionalString(formState.sizeCM) ?? null,
            price: priceValue ?? null,
            stockQuantity: stockValue ?? null,
            isAvailable: formState.isAvailable,
            mainImageUrl: optionalString(formState.mainImageUrl) ?? null,
            galleryImages: galleryPayload.length > 0 ? galleryPayload : undefined,
            videoUrl: optionalString(formState.videoUrl) ?? null,
            videoPosterUrl: optionalString(formState.videoPosterUrl) ?? null,
            videoDurationSeconds: videoDurationValue ?? null,
            shippingPrice: shippingPriceValue,
        };

        setSubmitting(true);
        try {
            await addJewelryItem(payload);
            showBanner("success", `“${payload.name}” was added to the catalog.`);
            setFormState(createInitialFormState());
            await refreshCatalog();
        } catch (error) {
            showBanner("error", resolveErrorMessage(error), 5000);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (item: JewelryItemForCard) => {
        if (!isAdmin) return;
        const confirmed = window.confirm(`Are you sure you want to delete "${item.name}"?`);
        if (!confirmed) return;

        setDeletingId(item.id);
        try {
            await deleteJewelryItem(item.id);
            setItems(prev => prev.filter(existing => existing.id !== item.id));
            showBanner("success", `“${item.name}” has been removed.`);
        } catch (error) {
            showBanner("error", resolveErrorMessage(error), 5000);
        } finally {
            setDeletingId(null);
        }
    };

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex flex-col" style={{ backgroundColor: PANEL_BACKGROUND }}>
                <Header />
                <main className="flex-1 w-full">
                    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                        <h1 className="text-4xl font-extrabold tracking-wide" style={{ color: BRAND_COLOR }}>
                            Control Panel
                        </h1>
                        <p className="mt-6 text-lg text-gray-600">
                            You do not have permission to view this page.
                        </p>
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center mt-8 px-6 py-2.5 text-sm font-semibold rounded-full shadow"
                            style={{ backgroundColor: BRAND_COLOR, color: "white" }}
                        >
                            Return to the home page
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: PANEL_BACKGROUND }}>
            <Header />
            <main className="flex-1 w-full">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="flex flex-col gap-3 mb-8">
                        <span className="uppercase tracking-[0.4em] text-xs font-semibold text-gray-500">
                            Admin Suite
                        </span>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ color: BRAND_COLOR }}>
                            Control Panel
                        </h1>
                        <p className="text-sm sm:text-base text-gray-600 max-w-2xl">
                            Manage the storefront inventory with precision. Add new pieces, curate their imagery, and retire items
                            that are no longer available — all from this dashboard.
                        </p>
                    </div>

                    {banner && (
                        <div
                            className={`mb-8 border-l-4 rounded-xl px-6 py-4 shadow-sm ${
                                banner.type === "success"
                                    ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                                    : "bg-red-50 border-red-400 text-red-700"
                            }`}
                        >
                            {banner.message}
                        </div>
                    )}

                    <div className="grid gap-10 lg:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
                        <section className="bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-6 py-5" style={{ backgroundColor: SECTION_HEADER }}>
                                <h2 className="text-xl font-bold" style={{ color: BRAND_COLOR }}>
                                    Add an item to the shop
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Fill in the details below to publish a new jewelry piece to the storefront.
                                </p>
                            </div>
                            <form className="p-6 space-y-6" onSubmit={handleSubmit}>
                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.name}
                                            onChange={event => updateFormField("name", event.target.value)}
                                            placeholder="E.g. Aurora Pendant"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Category <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            list="category-suggestions"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.category}
                                            onChange={event => updateFormField("category", event.target.value)}
                                            placeholder="Necklaces"
                                            required
                                        />
                                        {categorySuggestions.length > 0 && (
                                            <datalist id="category-suggestions">
                                                {categorySuggestions.map(option => (
                                                    <option key={option} value={option} />
                                                ))}
                                            </datalist>
                                        )}
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Description <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            rows={4}
                                            value={formState.description}
                                            onChange={event => updateFormField("description", event.target.value)}
                                            placeholder="Share the story, materials, and craftsmanship behind this item."
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Collection
                                        </label>
                                        <input
                                            type="text"
                                            list="collection-suggestions"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.collection}
                                            onChange={event => updateFormField("collection", event.target.value)}
                                            placeholder="Celestial Winter"
                                        />
                                        {collectionSuggestions.length > 0 && (
                                            <datalist id="collection-suggestions">
                                                {collectionSuggestions.map(option => (
                                                    <option key={option} value={option} />
                                                ))}
                                            </datalist>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Color
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.color}
                                            onChange={event => updateFormField("color", event.target.value)}
                                            placeholder="Rose Gold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Size (cm)
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.sizeCM}
                                            onChange={event => updateFormField("sizeCM", event.target.value)}
                                            placeholder="18"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Weight (grams)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.weightGrams}
                                            onChange={event => updateFormField("weightGrams", event.target.value)}
                                            placeholder="12.5"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Price (USD)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.price}
                                            onChange={event => updateFormField("price", event.target.value)}
                                            placeholder="450"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Shipping price (USD) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.shippingPrice}
                                            onChange={event => updateFormField("shippingPrice", event.target.value)}
                                            placeholder="15"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Stock quantity
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.stockQuantity}
                                            onChange={event => updateFormField("stockQuantity", event.target.value)}
                                            placeholder="10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Availability
                                        </label>
                                        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white/90 px-3 py-2">
                                            <input
                                                id="isAvailable"
                                                type="checkbox"
                                                className="h-4 w-4 accent-[rgba(107,140,142,0.75)]"
                                                checked={formState.isAvailable}
                                                onChange={event => updateFormField("isAvailable", event.target.checked)}
                                            />
                                            <label htmlFor="isAvailable" className="text-sm text-gray-600">
                                                Item can be purchased
                                            </label>
                                        </div>
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Main image URL
                                        </label>
                                        <input
                                            type="url"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.mainImageUrl}
                                            onChange={event => updateFormField("mainImageUrl", event.target.value)}
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                                Gallery images
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                Add as many supporting visuals as you need. Sort order controls their display sequence.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addGalleryRow}
                                            className="inline-flex items-center gap-2 rounded-full border border-[rgba(107,140,142,0.3)] px-3 py-1.5 text-xs font-semibold hover:bg-[rgba(107,140,142,0.08)]"
                                            style={{ color: BRAND_COLOR }}
                                        >
                                            + Add image
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {formState.galleryImages.map((row, index) => (
                                            <div
                                                key={index}
                                                className="rounded-xl border border-dashed border-gray-300 bg-white/70 p-4 space-y-3"
                                            >
                                                <div className="grid gap-3 md:grid-cols-[minmax(0,_3fr)_minmax(0,_1fr)]">
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                            Image URL
                                                        </label>
                                                        <input
                                                            type="url"
                                                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                                            value={row.url}
                                                            onChange={event => handleGalleryChange(index, "url", event.target.value)}
                                                            placeholder="https://..."
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                            Sort order
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                                            value={row.sortOrder}
                                                            onChange={event => handleGalleryChange(index, "sortOrder", event.target.value)}
                                                            placeholder={(index + 1).toString()}
                                                        />
                                                    </div>
                                                </div>
                                                {formState.galleryImages.length > 1 && (
                                                    <div className="text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeGalleryRow(index)}
                                                            className="text-xs font-semibold text-red-500 hover:text-red-600"
                                                        >
                                                            Remove image
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Video URL
                                        </label>
                                        <input
                                            type="url"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.videoUrl}
                                            onChange={event => updateFormField("videoUrl", event.target.value)}
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Video poster URL
                                        </label>
                                        <input
                                            type="url"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.videoPosterUrl}
                                            onChange={event => updateFormField("videoPosterUrl", event.target.value)}
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Video duration (seconds)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                            value={formState.videoDurationSeconds}
                                            onChange={event => updateFormField("videoDurationSeconds", event.target.value)}
                                            placeholder="45"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <p className="text-xs text-gray-500">
                                        All fields can be edited after publishing. Required fields are marked with *.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-70"
                                        style={{ backgroundColor: BRAND_COLOR }}
                                    >
                                        {submitting ? "Adding item…" : "Add item"}
                                    </button>
                                </div>
                            </form>
                        </section>

                        <section className="bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-6 py-5" style={{ backgroundColor: SECTION_HEADER }}>
                                <h2 className="text-xl font-bold" style={{ color: BRAND_COLOR }}>
                                    Remove an item from the shop
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Review the active inventory and retire items that should no longer be for sale.
                                </p>
                            </div>
                            <div className="p-6 space-y-5">
                                {itemsLoading ? (
                                    <div className="text-sm text-gray-600">Loading available items…</div>
                                ) : itemsError ? (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        {itemsError}
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 px-4 py-6 text-sm text-gray-500 text-center">
                                        No items found. Add new pieces to see them listed here.
                                    </div>
                                ) : (
                                    <ul className="space-y-4">
                                        {items.map(item => (
                                            <li
                                                key={item.id}
                                                className="rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                                                            {item.mainImageUrl ? (
                                                                <img
                                                                    src={item.mainImageUrl}
                                                                    alt={item.name}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                                                                    No image
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-base font-semibold text-gray-800 truncate">{item.name}</h3>
                                                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-gray-500">
                                                                <span>{item.category}</span>
                                                                {item.collection && <span>Collection: {item.collection}</span>}
                                                                <span>{item.isAvailable ? "Available" : "Hidden"}</span>
                                                            </div>
                                                            <p className="mt-1 text-sm text-gray-600">
                                                                {item.price.toLocaleString(undefined, {
                                                                    style: "currency",
                                                                    currency: "USD",
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item)}
                                                        disabled={deletingId === item.id}
                                                        className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-70"
                                                        style={{ backgroundColor: deletingId === item.id ? "#b91c1c" : "#dc2626" }}
                                                    >
                                                        {deletingId === item.id ? "Deleting…" : "Delete"}
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
