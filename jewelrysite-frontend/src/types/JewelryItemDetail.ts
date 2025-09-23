export interface JewelryGalleryImage {
    id?: number;
    jewelryItemId?: number;
    url: string;
    sortOrder?: number;
}

export interface JewelryItemDetail {
    id: number;
    name: string;
    mainImageUrl: string | null;
    galleryImages?: JewelryGalleryImage[];
    videoUrl?: string | null;
    videoPosterUrl?: string | null;
    description: string;
    category: string;
    collection?: string | null;
    weightGrams?: number | null;
    color?: string | null;
    sizeCM?: string | null;
    price?: number | null;
    stockQuantity?: number | null;
    isAvailable?: boolean | null;
    videoDurationSeconds?: number | null;
    shippingPrice?: number | null;
}
