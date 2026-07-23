import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  Calendar,
  CreditCard,
  Loader2,
  Scissors,
  Sparkles,
  Users,
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registerMutation = trpc.auth.register.useMutation();
  const loginMutation = trpc.auth.login.useMutation();

  const {
    data: practitioners,
    isLoading,
    error,
  } = trpc.practitioners.getAll.useQuery();

  const finalPractitioners = practitioners || [];

  return (
    <div className="min-h-screen hero-barber">
      {/* Header */}
      <header className="border-b border-border/60 bg-black/40 backdrop-blur-md sticky top-0 z-20">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-gradient shadow-orange-glow">
                <Scissors className="h-5 w-5 text-black" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Bispo-Barber
                </h1>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Corte & Estilo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    Olá,{" "}
                    <span className="text-primary font-medium">{user.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary"
                    onClick={() => setLocation("/dashboard")}
                  >
                    {user.role === "admin" ? "Dashboard" : "Meus agendamentos"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary"
                    onClick={() => {
                      setMode("login");
                      setFormError("");
                    }}
                  >
                    Entrar
                  </Button>
                  <Button
                    className="bg-primary text-primary-foreground"
                    onClick={() => {
                      setMode("register");
                      setFormError("");
                    }}
                  >
                    Registrar-se
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {!isAuthenticated && mode && (
        <section className="container py-6">
          <Card className="card-barber p-6 max-w-xl">
            <div className="flex items-center gap-2 mb-4">
              <Scissors className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">{mode === "login" ? "Login local" : "Cadastro local"}</h3>
            </div>

            <div className="flex gap-2 mb-4">
              <Button variant={mode === "login" ? "default" : "outline"} size="sm" onClick={() => { setMode("login"); setFormError(""); }}>Entrar</Button>
              <Button variant={mode === "register" ? "default" : "outline"} size="sm" onClick={() => { setMode("register"); setFormError(""); }}>Registrar</Button>
            </div>

            <form
              className="space-y-3"
              onSubmit={async event => {
                event.preventDefault();
                setFormError("");
                setIsSubmitting(true);
                try {
                  let result;
                  if (mode === "register") {
                    result = await registerMutation.mutateAsync({
                      name,
                      email,
                      password,
                    });
                  } else {
                    result = await loginMutation.mutateAsync({ email, password });
                  }

                  if (result?.success) {
                    setName("");
                    setEmail("");
                    setPassword("");
                    setMode(null);

                    if (result.user) {
                      utils.auth.me.setData(undefined, result.user);
                      const nextPath = result.user.role === "admin" ? "/dashboard/admin" : "/dashboard";
                      setLocation(nextPath);
                    } else {
                      const redirectWithRetry = async (attempt = 1) => {
                        try {
                          const me = await utils.auth.me.fetch();
                          if (me) {
                            const userPath = me.role === "admin" ? "/dashboard/admin" : "/dashboard";
                            setLocation(userPath);
                          } else if (attempt < 3) {
                            setTimeout(() => redirectWithRetry(attempt + 1), 400);
                          } else {
                            window.location.href = "/dashboard";
                          }
                        } catch (error) {
                          console.error("[Auth] Failed to fetch session after login:", error);
                          if (attempt < 3) {
                            setTimeout(() => redirectWithRetry(attempt + 1), 400);
                          } else {
                            window.location.href = "/dashboard";
                          }
                        }
                      };

                      void redirectWithRetry();
                    }
                  } else {
                    setFormError("Não foi possível concluir o acesso.");
                  }
                } catch (error: any) {
                  setFormError(error?.message || "Não foi possível concluir a operação");
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {mode === "register" && (
                <Input
                  placeholder="Seu nome"
                  value={name}
                  onChange={event => setName(event.target.value)}
                />
              )}
              <Input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
              <Input
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
              {formError ? <p className="text-sm text-red-500">{formError}</p> : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </form>
          </Card>
        </section>
      )}

      {/* Hero Section */}
      <section className="container py-16 md:py-20">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Scissors className="h-3.5 w-3.5" />
            Agende em poucos minutos
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="text-foreground">Seu próximo corte, </span>
            <span className="text-orange-gradient">na hora certa</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
            Escolha o horário e pague com segurança. Experiência
            premium, do agendamento ao acabamento.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Card className="card-barber p-4 flex items-start gap-3 transition-colors">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-gradient">
                <Calendar className="h-4 w-4 text-black" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Horários reais</h3>
                <p className="text-sm text-muted-foreground">
                  Veja vagas disponíveis e reserve na hora
                </p>
              </div>
            </Card>

            <Card className="card-barber p-4 flex items-start gap-3 transition-colors">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-gradient">
                <CreditCard className="h-4 w-4 text-black" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Pagamento seguro</h3>
                <p className="text-sm text-muted-foreground">
                  Checkout protegido com Stripe
                </p>
              </div>
            </Card>

            <Card className="card-barber p-4 flex items-start gap-3 transition-colors">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-gradient">
                <Sparkles className="h-4 w-4 text-black" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Barbeiro mais top da região</h3>
                <p className="text-sm text-muted-foreground">
                  Profissional pronto para o seu estilo
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Barbers Section */}
      <section className="border-y border-border/50 bg-black/30 py-16">
        <div className="container">
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <h2 className="text-3xl font-bold text-foreground">
                Nosso Barbeiro
              </h2>
            </div>
            {!isLoading && (
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    practitioners ? "bg-primary" : "bg-orange-400"
                  }`}
                />
                <span className="text-sm text-muted-foreground">
                  {practitioners
                    ? "Conectado à base"
                    : "Usando dados de demonstração"}
                </span>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin w-8 h-8 mr-3 text-primary" />
              <p className="text-muted-foreground">Carregando barbeiros...</p>
            </div>
          ) : error ? (
            <div className="text-center py-6 mb-6">
              <p className="text-primary mb-6">
                Não foi possível carregar da base. Exibindo dados de demonstração.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {finalPractitioners.map(practitioner => (
                  <BarberCard key={practitioner.id} practitioner={practitioner} />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {finalPractitioners.map(practitioner => (
                <BarberCard key={practitioner.id} practitioner={practitioner} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-16">
        <Card className="card-barber p-8 md:p-10 overflow-hidden relative">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-orange-gradient opacity-20 blur-2xl" />
          <div className="relative max-w-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-gradient shadow-orange-glow">
              <Scissors className="h-6 w-6 text-black" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Pronto para o corte?
            </h2>
            <p className="text-muted-foreground mb-6">
              Escolha um barbeiro acima e agende. Todo o fluxo leva cerca de 2 a
              3 minutos.
            </p>
            {finalPractitioners.length > 0 ? (
              <Button size="lg" asChild className="btn-barber border-0">
                <Link href={`/book/${finalPractitioners[0].id}`}>
                  <Scissors className="h-4 w-4" />
                  Agendar agora
                </Link>
              </Button>
            ) : (
              <Button size="lg" disabled className="btn-barber border-0 opacity-60">
                Nenhum barbeiro disponível
              </Button>
            )}
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-black/50">
        <div className="container py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                © 2026 Bispo-Barber. Todos os direitos reservados.
              </p>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">
                Privacidade
              </a>
              <a href="#" className="hover:text-primary transition-colors">
                Termos
              </a>
              <a href="#" className="hover:text-primary transition-colors">
                Contato
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function BarberCard({
  practitioner,
}: {
  practitioner: {
    id: string;
    name: string;
    description: string | null;
    hourlyRate: number;
  };
}) {
  return (
    <Card className="card-barber p-6 flex flex-col transition-all duration-200 hover:shadow-orange-glow">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-gradient shadow-orange-glow">
          <Scissors className="h-5 w-5 text-black" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-foreground truncate">
            {practitioner.name}
          </h3>
          <p className="text-xs uppercase tracking-wider text-primary/80">
            Barbeiro
          </p>
        </div>
      </div>

      <div className="flex-1">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {practitioner.description || "Especialista em cortes e acabamento."}
        </p>
      </div>

      <div className="border-t border-border/60 pt-4 mb-4">
        <p className="text-2xl font-bold text-orange-gradient">
  
        </p>
        <p className="text-xs text-muted-foreground"></p>
      </div>

      <Button asChild className="w-full btn-barber border-0">
        <Link href={`/book/${practitioner.id}`}>
          <Scissors className="h-4 w-4" />
          Agendar horário
        </Link>
      </Button>
    </Card>
  );
}
