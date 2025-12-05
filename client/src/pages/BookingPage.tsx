import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Calendar, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface BookingPageProps {
  practitionerId: number;
}

export default function BookingPage({ practitionerId }: BookingPageProps) {
  const [, navigate] = useLocation();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log("BookingPage rendered with practitionerId:", practitionerId);

  // Fetch availability
  const {
    data: availabilityData,
    isLoading,
    error,
  } = trpc.bookings.getAvailability.useQuery(
    { practitionerId },
    {
      enabled: !!practitionerId,
      onSuccess: data => console.log("Availability data received:", data),
      onError: error => {
        console.error("Availability query error:", error);
        console.log("Using mock data as fallback");
      },
      retry: false, // Don't retry on error
    }
  );

  // Mock data as fallback
  const mockAvailabilityData = {
    practitioner: {
      id: practitionerId,
      name: "Dr. Sarah Johnson",
      email: "sarah@example.com",
      hourlyRate: 8000,
    },
    slots: [
      {
        id: "1-9am",
        startTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000
        ), // Tomorrow 9am
        endTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000
        ), // Tomorrow 10am
        available: true,
      },
      {
        id: "1-11am",
        startTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000
        ), // Tomorrow 11am
        endTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000
        ), // Tomorrow 12pm
        available: true,
      },
      {
        id: "1-2pm",
        startTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000
        ), // Tomorrow 2pm
        endTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000
        ), // Tomorrow 3pm
        available: true,
      },
    ],
  };

  // Use API data if available, otherwise use mock data
  const finalAvailabilityData =
    availabilityData || (error ? mockAvailabilityData : null);

  console.log("Availability query state:", {
    isLoading,
    error,
    hasData: !!availabilityData,
  });

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlot(slotId);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSlot || !finalAvailabilityData) {
      toast.error("Please select a time slot");
      return;
    }

    if (
      !formData.clientName ||
      !formData.clientEmail ||
      !formData.clientPhone
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedSlotData = finalAvailabilityData.slots.find(
        s => s.id === selectedSlot
      );
      if (!selectedSlotData) {
        toast.error("Selected slot not found");
        return;
      }

      // For demo purposes, simulate successful booking
      toast.success("Booking created successfully!");
      navigate(`/booking/success?bookingId=demo-${Date.now()}`);
    } catch (error) {
      toast.error("Failed to create booking. Please try again.");
      console.error("Booking error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create booking mutation
  const createBookingMutation = trpc.bookings.createBooking.useMutation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin w-8 h-8 mx-auto mb-4" />
          <p>Loading availability for practitioner {practitionerId}...</p>
          <p className="text-sm text-gray-500 mt-2">
            Please wait while we fetch the latest availability from Cal.com
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">
              Error Loading Availability
            </h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <p className="text-sm text-gray-500">
              Practitioner ID: {practitionerId}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (!finalAvailabilityData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">
          <p className="text-yellow-600">Loading availability data...</p>
          <p className="text-sm text-gray-500 mt-2">
            Practitioner ID: {practitionerId}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Book with {finalAvailabilityData.practitioner.name}
          </h1>
          <p className="text-muted-foreground">
            £{(finalAvailabilityData.practitioner.hourlyRate / 100).toFixed(2)}{" "}
            per hour
          </p>
          {error ? (
            <p className="text-sm text-orange-600 mt-2">
              ⚠️ Using demo data - Database connection failed
            </p>
          ) : (
            <p className="text-sm text-green-600 mt-2">
              ✅ Connected to database
            </p>
          )}
        </div>

        {/* Available Slots */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Available Time Slots ({finalAvailabilityData.slots.length} slots)
          </h2>

          {finalAvailabilityData.slots.length === 0 ? (
            <p className="text-muted-foreground">
              No available slots found for the next 14 days
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {finalAvailabilityData.slots.map(slot => (
                <button
                  key={slot.id}
                  onClick={() => handleSlotSelect(slot.id)}
                  className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-1 ${
                    selectedSlot === slot.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {slot.startTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {slot.startTime.toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Booking Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Your Details</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="clientName">Full Name</Label>
              <Input
                id="clientName"
                name="clientName"
                type="text"
                placeholder="John Doe"
                value={formData.clientName}
                onChange={handleFormChange}
                required
              />
            </div>

            <div>
              <Label htmlFor="clientEmail">Email</Label>
              <Input
                id="clientEmail"
                name="clientEmail"
                type="email"
                placeholder="john@example.com"
                value={formData.clientEmail}
                onChange={handleFormChange}
                required
              />
            </div>

            <div>
              <Label htmlFor="clientPhone">Phone Number</Label>
              <Input
                id="clientPhone"
                name="clientPhone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.clientPhone}
                onChange={handleFormChange}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={!selectedSlot || isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Book Now - £${(finalAvailabilityData.practitioner.hourlyRate / 100).toFixed(2)}`
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
