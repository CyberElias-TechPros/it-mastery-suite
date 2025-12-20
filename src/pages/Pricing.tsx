import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/landing/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, ArrowRight, Zap, HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Pricing() {
  const plans = [
    {
      name: "Starter",
      description: "Perfect for small teams getting started with ITSM",
      price: 29,
      billing: "per user/month",
      popular: false,
      features: [
        { name: "Up to 10 users", included: true },
        { name: "Ticket management", included: true },
        { name: "Basic asset tracking", included: true },
        { name: "Email support", included: true },
        { name: "1 branch/location", included: true },
        { name: "Knowledge base", included: true },
        { name: "Custom reports", included: false },
        { name: "Automation rules", included: false },
        { name: "API access", included: false },
        { name: "Priority support", included: false },
      ],
    },
    {
      name: "Professional",
      description: "For growing teams that need more power and flexibility",
      price: 59,
      billing: "per user/month",
      popular: true,
      features: [
        { name: "Up to 50 users", included: true },
        { name: "Ticket management", included: true },
        { name: "Full asset management", included: true },
        { name: "Email & chat support", included: true },
        { name: "Up to 5 branches", included: true },
        { name: "Knowledge base", included: true },
        { name: "Custom reports", included: true },
        { name: "Automation rules", included: true },
        { name: "API access", included: false },
        { name: "Priority support", included: false },
      ],
    },
    {
      name: "Enterprise",
      description: "For large organizations with advanced requirements",
      price: 99,
      billing: "per user/month",
      popular: false,
      features: [
        { name: "Unlimited users", included: true },
        { name: "Ticket management", included: true },
        { name: "Full asset management", included: true },
        { name: "24/7 phone support", included: true },
        { name: "Unlimited branches", included: true },
        { name: "Knowledge base", included: true },
        { name: "Custom reports", included: true },
        { name: "Automation rules", included: true },
        { name: "API access", included: true },
        { name: "Priority support", included: true },
      ],
    },
  ];

  const faqs = [
    {
      question: "Can I try TechPros ITSM before purchasing?",
      answer: "Yes! We offer a 14-day free trial with full access to all Professional plan features. No credit card required to start.",
    },
    {
      question: "How does billing work?",
      answer: "We offer monthly and annual billing options. Annual billing gives you 2 months free (save 17%). You're only billed for active users.",
    },
    {
      question: "Can I change plans later?",
      answer: "Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate your billing.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for annual Enterprise contracts.",
    },
    {
      question: "Is there a setup fee?",
      answer: "No setup fees for Starter and Professional plans. Enterprise plans include complimentary onboarding and data migration assistance.",
    },
    {
      question: "Do you offer discounts for non-profits?",
      answer: "Yes! We offer 30% off for verified non-profit organizations and educational institutions. Contact our sales team to learn more.",
    },
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="secondary" className="px-4 py-2">
              <Zap className="h-3 w-3 mr-2" />
              Simple, Transparent Pricing
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Choose the Plan That Fits Your Team
            </h1>
            <p className="text-lg text-muted-foreground">
              Start free, scale as you grow. All plans include a 14-day trial with no credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground ml-2">{plan.billing}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Link to="/auth" className="block">
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                    >
                      Start Free Trial
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <div className="space-y-3">
                    {plan.features.map((feature, fIndex) => (
                      <div key={fIndex} className="flex items-center gap-3">
                        {feature.included ? (
                          <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={feature.included ? "text-foreground" : "text-muted-foreground"}>
                          {feature.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground">
              Need a custom solution?{" "}
              <Link to="/contact" className="text-primary hover:underline font-medium">
                Contact our sales team
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-primary/20">
              <CardContent className="p-8 md:p-12">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <Badge variant="outline">Enterprise</Badge>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                      Need Something More Custom?
                    </h2>
                    <p className="text-muted-foreground">
                      For organizations with complex requirements, we offer custom enterprise solutions with dedicated support, custom integrations, and SLA guarantees.
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Dedicated account manager
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Custom onboarding & training
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        99.9% uptime SLA
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Custom integrations available
                      </li>
                    </ul>
                  </div>
                  <div className="text-center md:text-right">
                    <Link to="/contact">
                      <Button size="lg">
                        Contact Sales
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <HelpCircle className="h-3 w-3 mr-2" />
                FAQ
              </Badge>
              <h2 className="text-3xl font-bold text-foreground">
                Frequently Asked Questions
              </h2>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold text-primary-foreground">
              Start Your Free Trial Today
            </h2>
            <p className="text-lg text-primary-foreground/80">
              14 days free. No credit card required. Full access to all features.
            </p>
            <Link to="/auth">
              <Button size="lg" variant="secondary">
                Get Started Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
