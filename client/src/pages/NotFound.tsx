import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, Scissors } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center hero-barber px-4">
      <Card className="w-full max-w-lg card-barber shadow-orange-glow border-0">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-gradient shadow-orange-glow">
              <Scissors className="h-6 w-6 text-black" strokeWidth={2.5} />
            </div>
          </div>

          <div className="flex justify-center mb-6">
            <AlertCircle className="h-14 w-14 text-primary" />
          </div>

          <h1 className="text-4xl font-bold text-orange-gradient mb-2">404</h1>

          <h2 className="text-xl font-semibold text-foreground mb-4">
            Página não encontrada
          </h2>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            Essa página não existe ou foi removida.
            <br />
            Volte à Barberia e escolha seu horário.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleGoHome}
              className="btn-barber border-0 px-6 py-2.5"
            >
              <Home className="w-4 h-4 mr-2" />
              Ir para o início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
