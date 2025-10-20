export interface CreateJewelryImageRequest {
    url: string;
    sortOrder?: number;
}

export interface CreateJewelryItemRequest {
    name: string;
    description: string;
    category: string;
    collection?: string | null;
    weightGrams?: number | null;
    color?: string | null;
    sizeCM?: string | null;
    price?: number | null;
    stockQuantity?: number | null;
    isAvailable?: boolean | null;
    mainImageUrl?: string | null;
    galleryImages?: CreateJewelryImageRequest[];
    videoUrl?: string | null;
    videoPosterUrl?: string | null;
    videoDurationSeconds?: number | null;
    shippingPrice: number;
}
