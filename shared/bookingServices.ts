export interface BookingService {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  description: string;
}

export const BOOKING_SERVICES: BookingService[] = [
  {
    id: "cabelo",
    name: "Cabelo",
    price: 25,
    durationMinutes: 30,
    description: "Corte de cabelo",
  },
  {
    id:"Cabelo-sobrancelha",
    name: "Cabelo e sobrancelha",
    price: 35,
    durationMinutes: 30,
    description: "Corte de cabelo e sobrancelha",
  },
  {
    id: "cabelo-barba",
    name: "Cabelo e barba",
    price: 35,
    durationMinutes: 30,
    description: "Corte de cabelo e barba",
  },
  {
    id: "cabelo-barba-sobrancelha",
    name: "Cabelo, barba e sobrancelha",
    price: 45,
    durationMinutes: 45,
    description: "Corte de cabelo, barba e sobrancelha",
  },
];

export function getBookingServiceById(id?: string | null): BookingService | undefined {
  return BOOKING_SERVICES.find(service => service.id === id);
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
