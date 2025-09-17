export interface JewelryGalleryImage {
    id?: number;
    jewelryItemId?: number;
    url: string;
    sortOrder?: number;
}

export interface JewelryItemDetail {
    id: number;
    name: string;
    mainImageUrl: string;
    galleryImages?: JewelryGalleryImage[];
    videoUrl?: string | null;
    videoPosterUrl?: string | null;
    description: string;
    price?: number | null;
    shippingPrice?: number | null;
}
