import { useCallback, useEffect, useMemo, useRef, useState, useId, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { decodeJwtPayload } from "../utils/jwt";
import { extractRoles } from "../utils/roles";
import {
    addJewelryItem,
    deleteJewelryItem,
    getCatalog,
    getCategories,
    getCollections,
    getJewelryItemById,
    updateJewelryItem,
} from "../api/jewelry";
import type { JewelryItemForCard } from "../types/JewelryItemForCard";
import type { CreateJewelryItemRequest } from "../types/JewelryItemAdmin";
import type { JewelryItemDetail } from "../types/JewelryItemDetail";

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

type BuildPayloadResult =
    | { success: true; payload: CreateJewelryItemRequest }
    | { success: false; error: string };

const buildPayloadFromForm = (state: FormState): BuildPayloadResult => {
    if (!state.name.trim() || !state.description.trim() || !state.category.trim()) {
        return { success: false, error: "Name, description, and category are required." };
    }

    const shippingPriceValue = parseDecimal(state.shippingPrice);
    if (shippingPriceValue === undefined) {
        return { success: false, error: "Please provide a valid shipping price." };
    }

    const priceValue = parseDecimal(state.price);
    const weightValue = parseDecimal(state.weightGrams);
    const stockValue = parseInteger(state.stockQuantity);
    const videoDurationValue = parseInteger(state.videoDurationSeconds);

    const galleryPayload = state.galleryImages
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
        name: state.name.trim(),
        description: state.description.trim(),
        category: state.category.trim(),
        collection: optionalString(state.collection) ?? null,
        weightGrams: weightValue ?? null,
        color: optionalString(state.color) ?? null,
        sizeCM: optionalString(state.sizeCM) ?? null,
        price: priceValue ?? null,
        stockQuantity: stockValue ?? null,
        isAvailable: state.isAvailable,
        mainImageUrl: optionalString(state.mainImageUrl) ?? null,
        galleryImages: galleryPayload.length > 0 ? galleryPayload : undefined,
        videoUrl: optionalString(state.videoUrl) ?? null,
        videoPosterUrl: optionalString(state.videoPosterUrl) ?? null,
        videoDurationSeconds: videoDurationValue ?? null,
        shippingPrice: shippingPriceValue,
    };

    return { success: true, payload };
};

const mapDetailToFormState = (detail: JewelryItemDetail): FormState => {
    const sortedGallery = [...(detail.galleryImages ?? [])].sort((a, b) => {
        const aOrder = a.sortOrder ?? 0;
        const bOrder = b.sortOrder ?? 0;
        return aOrder - bOrder;
    });

    return {
        name: detail.name ?? "",
        description: detail.description ?? "",
        category: detail.category ?? "",
        collection: detail.collection ?? "",
        weightGrams: detail.weightGrams !== undefined && detail.weightGrams !== null ? String(detail.weightGrams) : "",
        color: detail.color ?? "",
        sizeCM: detail.sizeCM ?? "",
        price: detail.price !== undefined && detail.price !== null ? String(detail.price) : "",
        stockQuantity:
            detail.stockQuantity !== undefined && detail.stockQuantity !== null ? String(detail.stockQuantity) : "",
        isAvailable: detail.isAvailable ?? true,
        mainImageUrl: detail.mainImageUrl ?? "",
        galleryImages:
            sortedGallery.length > 0
                ? sortedGallery.map(image => ({
                      url: image.url ?? "",
                      sortOrder:
                          image.sortOrder !== undefined && image.sortOrder !== null
                              ? String(image.sortOrder)
                              : "",
                  }))
                : [{ url: "", sortOrder: "" }],
        videoUrl: detail.videoUrl ?? "",
        videoPosterUrl: detail.videoPosterUrl ?? "",
        videoDurationSeconds:
            detail.videoDurationSeconds !== undefined && detail.videoDurationSeconds !== null
                ? String(detail.videoDurationSeconds)
                : "",
        shippingPrice:
            detail.shippingPrice !== undefined && detail.shippingPrice !== null ? String(detail.shippingPrice) : "",
    };
};

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
    const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null);
    const [deleteSearchTerm, setDeleteSearchTerm] = useState("");
    const [updateSearchTerm, setUpdateSearchTerm] = useState("");
    const [updateFormState, setUpdateFormState] = useState<FormState>(() => createInitialFormState());
    const [selectedUpdateItemId, setSelectedUpdateItemId] = useState<number | null>(null);
    const [selectedUpdateItemName, setSelectedUpdateItemName] = useState<string | null>(null);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateSubmitting, setUpdateSubmitting] = useState(false);
    const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const updateRequestIdRef = useRef(0);

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

    const updateExistingFormField = useCallback(
        <K extends keyof FormState>(key: K, value: FormState[K]) => {
            setUpdateFormState(prev => ({ ...prev, [key]: value }));
        },
        []
    );

    const handleUpdateGalleryChange = (index: number, field: keyof GalleryFormRow, value: string) => {
        setUpdateFormState(prev => {
            const nextRows = prev.galleryImages.map((row, rowIndex) =>
                rowIndex === index ? { ...row, [field]: value } : row
            );
            return { ...prev, galleryImages: nextRows };
        });
    };

    const addUpdateGalleryRow = () => {
        setUpdateFormState(prev => ({
            ...prev,
            galleryImages: [...prev.galleryImages, { url: "", sortOrder: "" }],
        }));
    };

    const removeUpdateGalleryRow = (index: number) => {
        setUpdateFormState(prev => {
            const nextRows = prev.galleryImages.filter((_, rowIndex) => rowIndex !== index);
            return {
                ...prev,
                galleryImages: nextRows.length > 0 ? nextRows : [{ url: "", sortOrder: "" }],
            };
        });
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isAdmin) return;
        const result = buildPayloadFromForm(formState);
        if (!result.success) {
            showBanner("error", result.error, 4500);
            return;
        }

        setSubmitting(true);
        try {
            await addJewelryItem(result.payload);
            showBanner("success", `“${result.payload.name}” was added to the catalog.`);
            setFormState(createInitialFormState());
            await refreshCatalog();
        } catch (error) {
            showBanner("error", resolveErrorMessage(error), 5000);
        } finally {
            setSubmitting(false);
        }
    };

    const requestDeleteConfirmation = (itemId: number) => {
        setDeleteConfirmationId(prev => (prev === itemId ? null : itemId));
    };

    const cancelDeleteRequest = () => {
        setDeleteConfirmationId(null);
    };

    const handleDelete = async (item: JewelryItemForCard) => {
        if (!isAdmin) return;
        setDeleteConfirmationId(item.id);
        setDeletingId(item.id);
        try {
            await deleteJewelryItem(item.id);
            setItems(prev => prev.filter(existing => existing.id !== item.id));
            showBanner("success", `“${item.name}” has been removed.`);
            await refreshCatalog();
        } catch (error) {
            showBanner("error", resolveErrorMessage(error), 5000);
        } finally {
            setDeleteConfirmationId(null);
            setDeletingId(null);
        }
    };

    const handleSelectForUpdate = useCallback(
        async (item: JewelryItemForCard) => {
            if (!isAdmin) return;

            const requestId = updateRequestIdRef.current + 1;
            updateRequestIdRef.current = requestId;

            setSelectedUpdateItemId(item.id);
            setSelectedUpdateItemName(item.name);
            setUpdateFormState(createInitialFormState());
            setUpdateLoading(true);

            try {
                const detail = await getJewelryItemById(item.id);
                if (updateRequestIdRef.current !== requestId) {
                    return;
                }
                setUpdateFormState(mapDetailToFormState(detail));
                setSelectedUpdateItemName(detail.name ?? item.name);
            } catch (error) {
                if (updateRequestIdRef.current === requestId) {
                    showBanner("error", resolveErrorMessage(error), 5000);
                    setSelectedUpdateItemId(null);
                    setSelectedUpdateItemName(null);
                }
            } finally {
                if (updateRequestIdRef.current === requestId) {
                    setUpdateLoading(false);
                }
            }
        },
        [isAdmin, showBanner]
    );

    const handleCancelUpdate = useCallback(() => {
        updateRequestIdRef.current += 1;
        setSelectedUpdateItemId(null);
        setSelectedUpdateItemName(null);
        setUpdateFormState(createInitialFormState());
        setUpdateLoading(false);
        setUpdateSubmitting(false);
    }, []);

    const handleUpdateSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isAdmin || selectedUpdateItemId === null) return;

        const result = buildPayloadFromForm(updateFormState);
        if (!result.success) {
            showBanner("error", result.error, 4500);
            return;
        }

        setUpdateSubmitting(true);
        try {
            await updateJewelryItem(selectedUpdateItemId, result.payload);
            showBanner("success", `“${result.payload.name}” was updated.`);
            await refreshCatalog();
            const requestId = updateRequestIdRef.current + 1;
            updateRequestIdRef.current = requestId;
            try {
                setUpdateLoading(true);
                const latest = await getJewelryItemById(selectedUpdateItemId);
                if (updateRequestIdRef.current === requestId) {
                    setUpdateFormState(mapDetailToFormState(latest));
                    setSelectedUpdateItemName(latest.name ?? result.payload.name);
                }
            } catch (refreshError) {
                if (updateRequestIdRef.current === requestId) {
                    console.warn("Failed to refresh updated item", refreshError);
                }
            } finally {
                if (updateRequestIdRef.current === requestId) {
                    setUpdateLoading(false);
                }
            }
        } catch (error) {
            showBanner("error", resolveErrorMessage(error), 5000);
        } finally {
            setUpdateSubmitting(false);
        }
    };

    const filteredDeleteItems = useMemo(() => {
        const term = deleteSearchTerm.trim().toLowerCase();
        if (!term) return items;
        return items.filter(item => {
            const haystack = [
                item.name,
                item.category,
                item.collection,
                item.description,
                item.color,
                item.sizeCM,
            ]
                .filter(Boolean)
                .map(value => value.toLowerCase());
            const price = Number.isFinite(item.price) ? item.price.toString() : "";
            return haystack.some(value => value.includes(term)) || price.includes(term);
        });
    }, [deleteSearchTerm, items]);

    const filteredUpdateItems = useMemo(() => {
        const term = updateSearchTerm.trim().toLowerCase();
        if (!term) return items;
        return items.filter(item => {
            const haystack = [
                item.name,
                item.category,
                item.collection,
                item.description,
                item.color,
                item.sizeCM,
            ]
                .filter(Boolean)
                .map(value => value.toLowerCase());
            const price = Number.isFinite(item.price) ? item.price.toString() : "";
            return haystack.some(value => value.includes(term)) || price.includes(term);
        });
    }, [items, updateSearchTerm]);

    const noItemsInCatalog = items.length === 0;
    const noDeleteMatches = filteredDeleteItems.length === 0 && items.length > 0;
    const noUpdateMatches = filteredUpdateItems.length === 0 && items.length > 0;

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

                    <div className="flex flex-col gap-10">
                        <section className="bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-6 py-5" style={{ backgroundColor: SECTION_HEADER }}>
                                <h2 className="text-xl font-bold" style={{ color: BRAND_COLOR }}>
                                    Add an item to the shop
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Fill in the details below to publish a new jewelry piece to the storefront.
                                </p>
                            </div>
                            <ItemForm
                                formState={formState}
                                onFieldChange={updateFormField}
                                onGalleryChange={handleGalleryChange}
                                onAddGalleryRow={addGalleryRow}
                                onRemoveGalleryRow={removeGalleryRow}
                                onSubmit={handleSubmit}
                                submitting={submitting}
                                submitLabel="Add item"
                                submittingLabel="Adding item…"
                                categorySuggestions={categorySuggestions}
                                collectionSuggestions={collectionSuggestions}
                                brandColor={BRAND_COLOR}
                            />
                        </section>

                        <section className="bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-6 py-5" style={{ backgroundColor: SECTION_HEADER }}>
                                <h2 className="text-xl font-bold" style={{ color: BRAND_COLOR }}>
                                    Update an existing item
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Locate an item to review and modify its details before saving changes.
                                </p>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="update-search">
                                        Search inventory to modify
                                    </label>
                                    <input
                                        id="update-search"
                                        type="search"
                                        value={updateSearchTerm}
                                        onChange={event => setUpdateSearchTerm(event.target.value)}
                                        placeholder="Search by name, category, collection, or color"
                                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                    />
                                </div>
                                <div className="space-y-4">
                                    {itemsLoading ? (
                                        <div className="text-sm text-gray-600">Loading available items…</div>
                                    ) : itemsError ? (
                                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                            {itemsError}
                                        </div>
                                    ) : noItemsInCatalog ? (
                                        <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 px-4 py-6 text-sm text-gray-500 text-center">
                                            No items found. Add new pieces to see them listed here.
                                        </div>
                                    ) : noUpdateMatches ? (
                                        <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 px-4 py-6 text-sm text-gray-500 text-center">
                                            No items match your search. Try broadening it.
                                        </div>
                                    ) : (
                                        <ul className="space-y-4">
                                            {filteredUpdateItems.map(item => {
                                                const isSelected = selectedUpdateItemId === item.id;
                                                const isLoadingThisItem = updateLoading && isSelected;
                                                return (
                                                    <li
                                                        key={item.id}
                                                        className={`rounded-xl border ${
                                                            isSelected
                                                                ? "border-[rgba(107,140,142,0.45)] shadow-md ring-2 ring-[rgba(107,140,142,0.18)]"
                                                                : "border-gray-200 shadow-sm"
                                                        } bg-white/90 p-4 transition-shadow`}
                                                    >
                                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                                            <div className="flex items-center gap-4 flex-1">
                                                                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                                                                    {item.mainImageUrl ? (
                                                                        <img src={item.mainImageUrl} alt={item.name} className="h-full w-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-[10px] uppercase tracking-wide text-gray-400">No image</span>
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
                                                                            currencyDisplay: "code",
                                                                        })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectForUpdate(item)}
                                                                disabled={isLoadingThisItem || updateSubmitting}
                                                                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-70"
                                                                style={{ backgroundColor: BRAND_COLOR }}
                                                            >
                                                                {isLoadingThisItem ? "Loading…" : isSelected ? "Selected" : "Modify"}
                                                            </button>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                                <div className="pt-6 border-t border-gray-100">
                                    {selectedUpdateItemId === null ? (
                                        <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 px-4 py-6 text-sm text-gray-500 text-center">
                                            Select an item above to load its details.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-700">
                                                        {selectedUpdateItemName
                                                            ? `Editing: ${selectedUpdateItemName}`
                                                            : "Modify selected item"}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Changes are only saved after selecting “Modify item”.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelUpdate}
                                                    className="inline-flex items-center justify-center rounded-full border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                                                >
                                                    Close without saving
                                                </button>
                                            </div>
                                            {updateLoading ? (
                                                <div className="text-sm text-gray-600">Loading item details…</div>
                                            ) : (
                                                <ItemForm
                                                    formState={updateFormState}
                                                    onFieldChange={updateExistingFormField}
                                                    onGalleryChange={handleUpdateGalleryChange}
                                                    onAddGalleryRow={addUpdateGalleryRow}
                                                    onRemoveGalleryRow={removeUpdateGalleryRow}
                                                    onSubmit={handleUpdateSubmit}
                                                    submitting={updateSubmitting}
                                                    submitLabel="Modify item"
                                                    submittingLabel="Saving changes…"
                                                    categorySuggestions={categorySuggestions}
                                                    collectionSuggestions={collectionSuggestions}
                                                    brandColor={BRAND_COLOR}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
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
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="delete-search">
                                        Search catalog
                                    </label>
                                    <input
                                        id="delete-search"
                                        type="search"
                                        value={deleteSearchTerm}
                                        onChange={event => setDeleteSearchTerm(event.target.value)}
                                        placeholder="Search by name, category, collection, or color"
                                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                                    />
                                </div>
                                {itemsLoading ? (
                                    <div className="text-sm text-gray-600">Loading available items…</div>
                                ) : itemsError ? (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        {itemsError}
                                    </div>
                                ) : noItemsInCatalog ? (
                                    <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 px-4 py-6 text-sm text-gray-500 text-center">
                                        No items found. Add new pieces to see them listed here.
                                    </div>
                                ) : noDeleteMatches ? (
                                    <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 px-4 py-6 text-sm text-gray-500 text-center">
                                        No items match your search. Try a different keyword.
                                    </div>
                                ) : (
                                    <ul className="space-y-4">
                                        {filteredDeleteItems.map(item => (
                                            <li
                                                key={item.id}
                                                className="rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6">
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                                                            {item.mainImageUrl ? (
                                                                <img src={item.mainImageUrl} alt={item.name} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span className="text-[10px] uppercase tracking-wide text-gray-400">No image</span>
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
                                                                    currencyDisplay: "code",
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2 sm:flex-none sm:items-end sm:justify-center sm:text-right">
                                                        {deleteConfirmationId === item.id ? (
                                                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelDeleteRequest}
                                                                    disabled={deletingId === item.id}
                                                                    className="inline-flex w-full items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                                                                >
                                                                    Keep item
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(item)}
                                                                    disabled={deletingId === item.id}
                                                                    className="inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                                                                    style={{ backgroundColor: deletingId === item.id ? "#b91c1c" : "#dc2626" }}
                                                                >
                                                                    {deletingId === item.id ? "Deleting…" : "Confirm delete"}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-1 text-sm text-red-700">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => requestDeleteConfirmation(item.id)}
                                                                    className="inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg sm:w-auto"
                                                                    style={{ backgroundColor: "#dc2626" }}
                                                                >
                                                                    Delete
                                                                </button>
                                                                <span className="text-xs font-medium text-red-500 sm:text-right">This can’t be undone</span>
                                                            </div>
                                                        )}
                                                    </div>
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

type ItemFormProps = {
    formState: FormState;
    onFieldChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
    onGalleryChange: (index: number, field: keyof GalleryFormRow, value: string) => void;
    onAddGalleryRow: () => void;
    onRemoveGalleryRow: (index: number) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    submitting: boolean;
    submitLabel: string;
    submittingLabel: string;
    categorySuggestions: string[];
    collectionSuggestions: string[];
    brandColor: string;
};

function ItemForm({
    formState,
    onFieldChange,
    onGalleryChange,
    onAddGalleryRow,
    onRemoveGalleryRow,
    onSubmit,
    submitting,
    submitLabel,
    submittingLabel,
    categorySuggestions,
    collectionSuggestions,
    brandColor,
}: ItemFormProps) {
    const categoryListId = useId();
    const collectionListId = useId();

    return (
        <form className="p-6 space-y-6" onSubmit={onSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                        value={formState.name}
                        onChange={event => onFieldChange("name", event.target.value)}
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
                        list={categoryListId}
                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                        value={formState.category}
                        onChange={event => onFieldChange("category", event.target.value)}
                        placeholder="Necklaces"
                        required
                    />
                    {categorySuggestions.length > 0 && (
                        <datalist id={categoryListId}>
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
                        onChange={event => onFieldChange("description", event.target.value)}
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
                        list={collectionListId}
                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                        value={formState.collection}
                        onChange={event => onFieldChange("collection", event.target.value)}
                        placeholder="Celestial Winter"
                    />
                    {collectionSuggestions.length > 0 && (
                        <datalist id={collectionListId}>
                            {collectionSuggestions.map(option => (
                                <option key={option} value={option} />
                            ))}
                        </datalist>
                    )}
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Color</label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                        value={formState.color}
                        onChange={event => onFieldChange("color", event.target.value)}
                        placeholder="Rose Gold"
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
                        onChange={event => onFieldChange("weightGrams", event.target.value)}
                        placeholder="4.5"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Size (cm)</label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                        value={formState.sizeCM}
                        onChange={event => onFieldChange("sizeCM", event.target.value)}
                        placeholder="18"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Price</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                        value={formState.price}
                        onChange={event => onFieldChange("price", event.target.value)}
                        placeholder="120"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Shipping price <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                        value={formState.shippingPrice}
                        onChange={event => onFieldChange("shippingPrice", event.target.value)}
                        placeholder="7.5"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stock</label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                        value={formState.stockQuantity}
                        onChange={event => onFieldChange("stockQuantity", event.target.value)}
                        placeholder="3"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Visibility</label>
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white/90 px-3 py-2">
                        <input
                            id={`available-${categoryListId}`}
                            type="checkbox"
                            checked={formState.isAvailable}
                            onChange={event => onFieldChange("isAvailable", event.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-[rgba(107,140,142,0.8)] focus:ring-[rgba(107,140,142,0.45)]"
                        />
                        <label htmlFor={`available-${categoryListId}`} className="text-sm text-gray-700">
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
                        onChange={event => onFieldChange("mainImageUrl", event.target.value)}
                        placeholder="https://..."
                    />
                    {formState.mainImageUrl && (
                        <div className="flex items-center gap-3 pt-2">
                            <div className="h-20 w-20 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                <img
                                    src={formState.mainImageUrl}
                                    alt={`${formState.name || "Main"} preview`}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <a
                                href={formState.mainImageUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-xs font-semibold"
                                style={{ color: brandColor }}
                            >
                                Open full size
                            </a>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Gallery images</h3>
                        <p className="text-xs text-gray-500">
                            Add as many supporting visuals as you need. Sort order controls their display sequence.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onAddGalleryRow}
                        className="inline-flex items-center gap-2 rounded-full border border-[rgba(107,140,142,0.3)] px-3 py-1.5 text-xs font-semibold hover:bg-[rgba(107,140,142,0.08)]"
                        style={{ color: brandColor }}
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
                                        onChange={event => onGalleryChange(index, "url", event.target.value)}
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
                                        onChange={event => onGalleryChange(index, "sortOrder", event.target.value)}
                                        placeholder={(index + 1).toString()}
                                    />
                                </div>
                            </div>
                            {row.url && (
                                <div className="flex items-center gap-3 pt-1">
                                    <div className="h-20 w-20 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                        <img
                                            src={row.url}
                                            alt={`Gallery image ${index + 1}`}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <a
                                        href={row.url}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="text-xs font-semibold"
                                        style={{ color: brandColor }}
                                    >
                                        Open image
                                    </a>
                                </div>
                            )}
                            {formState.galleryImages.length > 1 && (
                                <div className="text-right">
                                    <button
                                        type="button"
                                        onClick={() => onRemoveGalleryRow(index)}
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
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Video URL</label>
                    <input
                        type="url"
                        className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgba(107,140,142,0.35)]"
                        value={formState.videoUrl}
                        onChange={event => onFieldChange("videoUrl", event.target.value)}
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
                        onChange={event => onFieldChange("videoPosterUrl", event.target.value)}
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
                        onChange={event => onFieldChange("videoDurationSeconds", event.target.value)}
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
                    style={{ backgroundColor: brandColor }}
                >
                    {submitting ? submittingLabel : submitLabel}
                </button>
            </div>
        </form>
    );
}
