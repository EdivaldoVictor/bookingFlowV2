import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Home, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function BookingSuccess() {
  const [location, navigate] = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);

  // Extract session_id from URL params (from Stripe redirect)
  const params = new URLSearchParams(location.split("?")[1]);
  const sessionId = params.get("session_id");
  const bookingId = params.get("bookingId"); // Fallback if direct link

  // Try to get booking by session_id first (preferred)
  const { data: bookingBySession, isLoading: isLoadingBySession } = 
    trpc.bookings.getBookingBySessionId.useQuery(
      { sessionId: sessionId || "" },
      {
        enabled: !!sessionId,
        retry: 2,
        retryDelay: 1000, // Wait 1 second before retry (webhook might still be processing)
      }
    );

  // Fallback: get booking by ID if we have bookingId but no sessionId
  const { data: bookingById, isLoading: isLoadingById } = 
    trpc.bookings.getBooking.useQuery(
      { bookingId: bookingId || "" },
      {
        enabled: !!bookingId && !sessionId,
        retry: false,
      }
    );

  const bookingData = bookingBySession || bookingById;
  const isLoading = isLoadingBySession || isLoadingById;

  useEffect(() => {
    if (sessionId) {
      console.log("[BookingSuccess] Session ID from Stripe:", sessionId);
      // The webhook should have already processed the payment
      // We can show success immediately
      setIsVerifying(false);
    } else if (bookingId) {
      // If we have bookingId, try to verify
      setIsVerifying(isLoading);
    } else {
      // No session_id or bookingId - might be direct access
      setIsVerifying(false);
    }
  }, [sessionId, bookingId, isLoading]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-8 px-4">
      <Card className="max-w-md w-full p-8 text-center">
        {isVerifying ? (
          <>
            <div className="flex justify-center mb-6">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Verifying Payment...
            </h1>
            <p className="text-muted-foreground">
              Please wait while we confirm your payment.
            </p>
          </>
        ) : (
          <>
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
                {sessionId && (
                  <div>
                    <p className="text-sm text-muted-foreground">Stripe Session</p>
                    <p className="font-mono text-xs font-semibold text-foreground break-all">
                      {sessionId}
                    </p>
                  </div>
                )}
                {bookingId && (
                  <div>
                    <p className="text-sm text-muted-foreground">Booking ID</p>
                    <p className="font-mono font-semibold text-foreground">
                      {bookingId}
                    </p>
                  </div>
                )}
                {bookingData && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-semibold text-green-600">
                        {bookingData.status || "Confirmed"}
                      </p>
                    </div>
                    {bookingData.clientName && (
                      <div>
                        <p className="text-sm text-muted-foreground">Client</p>
                        <p className="font-semibold text-foreground">
                          {bookingData.clientName}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {!sessionId && !bookingId && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="w-4 h-4" />
                    <p className="text-sm">No booking information available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation Message */}
            <p className="text-sm text-muted-foreground mb-8">
              {sessionId
                ? "Your payment has been processed successfully. A confirmation email will be sent shortly."
                : "A confirmation email has been sent to your email address with all the details of your appointment."}
            </p>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button onClick={() => navigate("/")} className="w-full" size="lg">
                <Home className="mr-2 w-4 h-4" />
                Back to Home
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
