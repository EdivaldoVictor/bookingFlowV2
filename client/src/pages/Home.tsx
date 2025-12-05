import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Calendar, Users, CreditCard, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  // Fetch practitioners from backend
  const {
    data: practitioners,
    isLoading,
    error,
  } = trpc.practitioners.getAll.useQuery();

  // Mock data fallback
  const mockPractitioners = [
    {
      id: 1,
      name: "Dr. Sarah Johnson",
      description: "Clinical Psychologist",
      hourlyRate: 8000, // £80 in pence
    },
    {
      id: 2,
      name: "Dr. Michael Chen",
      description: "Therapist",
      hourlyRate: 7500, // £75 in pence
    },
    {
      id: 3,
      name: "Emma Wilson",
      description: "Counselor",
      hourlyRate: 6000, // £60 in pence
    },
  ];

  // Use API data if available, otherwise use mock data
  const finalPractitioners = practitioners || mockPractitioners;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Healgrid</h1>
            <div className="flex items-center gap-4">
              {isAuthenticated && user ? (
                <div className="text-sm text-muted-foreground">
                  Welcome, {user.name}
                </div>
              ) : (
                <Button asChild variant="outline">
                  <a href={getLoginUrl()}>Sign In</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-16">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Book Your Appointment in Minutes
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Fast, secure booking with instant payment processing. Choose your
            preferred practitioner and time slot.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
            <Card className="p-4 flex items-start gap-3">
              <Calendar className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">
                  Easy Scheduling
                </h3>
                <p className="text-sm text-muted-foreground">
                  View available slots and book instantly
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">
                  Secure Payment
                </h3>
                <p className="text-sm text-muted-foreground">
                  Safe payment processing with Stripe
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-start gap-3">
              <Users className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">
                  Expert Practitioners
                </h3>
                <p className="text-sm text-muted-foreground">
                  Qualified professionals ready to help
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Practitioners Section */}
      <section className="bg-muted/30 py-16">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-foreground">
              Our Practitioners
            </h2>
            {!isLoading && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  practitioners ? 'bg-green-500' : 'bg-orange-500'
                }`} />
                <span className="text-sm text-muted-foreground">
                  {practitioners ? 'Connected to database' : 'Using demo data'}
                </span>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin w-8 h-8 mr-3" />
              <p className="text-muted-foreground">Loading practitioners...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">
                Failed to load practitioners. Using demo data.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {finalPractitioners.map(practitioner => (
                  <Card key={practitioner.id} className="p-6 flex flex-col border-orange-200">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground mb-1">
                        {practitioner.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {practitioner.description}
                      </p>
                    </div>

                    <div className="border-t border-border pt-4 mb-4">
                      <p className="text-2xl font-bold text-foreground">
                        £{(practitioner.hourlyRate / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">per hour</p>
                    </div>

                    <Button asChild className="w-full">
                      <Link href={`/book/${practitioner.id}`}>
                        Book Appointment
                      </Link>
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {finalPractitioners.map(practitioner => (
                <Card key={practitioner.id} className="p-6 flex flex-col">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-1">
                      {practitioner.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {practitioner.description}
                    </p>
                  </div>

                  <div className="border-t border-border pt-4 mb-4">
                    <p className="text-2xl font-bold text-foreground">
                      £{(practitioner.hourlyRate / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">per hour</p>
                  </div>

                  <Button asChild className="w-full">
                    <Link href={`/book/${practitioner.id}`}>
                      Book Appointment
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-16">
        <Card className="p-8 bg-primary/5 border-primary/20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground mb-6">
              Choose a practitioner above and book your appointment. The entire
              process takes just 2-3 minutes.
            </p>
            <Button size="lg" asChild>
              <Link href="/book/1">Book Your First Appointment</Link>
            </Button>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 Healgrid. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
