import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Home } from "lucide-react";

export default function BookingSuccess() {
  const [location, navigate] = useLocation();

  // Extract booking ID from URL params
  const params = new URLSearchParams(location.split("?")[1]);
  const bookingId = params.get("bookingId");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-8 px-4">
      <Card className="max-w-md w-full p-8 text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Booking Confirmed!
        </h1>
        <p className="text-muted-foreground mb-6">
          Your appointment has been successfully booked and payment has been
          processed.
        </p>

        {/* Booking Details */}
        <div className="bg-muted p-4 rounded-lg mb-6 text-left">
          <div className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Booking ID</p>
              <p className="font-mono font-semibold text-foreground">
                {bookingId || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-semibold text-green-600">Confirmed</p>
            </div>
          </div>
        </div>

        {/* Confirmation Message */}
        <p className="text-sm text-muted-foreground mb-8">
          A confirmation email has been sent to your email address with all the
          details of your appointment.
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button onClick={() => navigate("/")} className="w-full" size="lg">
            <Home className="mr-2 w-4 h-4" />
            Back to Home
          </Button>
        </div>
      </Card>
    </div>
  );
}
