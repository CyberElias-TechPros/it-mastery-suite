import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/landing/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Ticket,
  Package,
  BarChart3,
  Users,
  Shield,
  Zap,
  Clock,
  CheckCircle,
  ArrowRight,
  Star,
  Building,
  Fuel,
  DollarSign,
  BookOpen,
  Bell,
  Settings,
} from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: Ticket,
      title: "Ticket Management",
      description: "Streamline IT support with smart ticketing, SLA tracking, and automated workflows.",
    },
    {
      icon: Package,
      title: "Asset Management",
      description: "Track hardware, software, and inventory across your entire organization.",
    },
    {
      icon: Users,
      title: "User Management",
      description: "Role-based access control with support for multiple branches and departments.",
    },
    {
      icon: DollarSign,
      title: "Expense Tracking",
      description: "Monitor and approve expenses with detailed reporting and budget controls.",
    },
    {
      icon: Fuel,
      title: "Diesel Monitoring",
      description: "Track generator fuel consumption, costs, and running hours efficiently.",
    },
    {
      icon: Building,
      title: "Multi-Branch Support",
      description: "Manage operations across multiple locations from a single dashboard.",
    },
    {
      icon: BookOpen,
      title: "Knowledge Base",
      description: "Build a searchable repository of solutions and best practices.",
    },
    {
      icon: BarChart3,
      title: "Custom Reports",
      description: "Create drag-and-drop reports with advanced filtering and export options.",
    },
  ];

  const stats = [
    { value: "99.9%", label: "Uptime SLA" },
    { value: "50%", label: "Faster Resolution" },
    { value: "10K+", label: "Tickets Resolved" },
    { value: "24/7", label: "Support Available" },
  ];

  const testimonials = [
    {
      quote: "TechPros ITSM transformed our IT operations. We've reduced resolution time by 60% and our team is more productive than ever.",
      author: "Sarah Johnson",
      role: "IT Director",
      company: "Global Tech Corp",
    },
    {
      quote: "The asset management feature alone saved us thousands in tracking hardware across 15 branches. Highly recommended!",
      author: "Michael Chen",
      role: "Operations Manager",
      company: "Nexus Industries",
    },
    {
      quote: "Finally, an ITSM solution that's both powerful and easy to use. Our technicians were up and running in hours, not weeks.",
      author: "Emily Rodriguez",
      role: "CTO",
      company: "StartupX",
    },
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container relative mx-auto px-4 py-24 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Badge variant="secondary" className="px-4 py-2">
              <Zap className="h-3 w-3 mr-2" />
              Enterprise-Grade ITSM Platform
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
              Streamline Your IT Operations with{" "}
              <span className="text-primary">TechPros ITSM</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              The complete IT Service Management solution for modern businesses. Manage tickets, assets, expenses, and more from a single powerful platform.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8">
                  Explore Features
                </Button>
              </Link>
            </div>

            <p className="text-sm text-muted-foreground">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-card border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Manage IT
            </h2>
            <p className="text-lg text-muted-foreground">
              A comprehensive suite of tools designed to streamline your IT operations and boost team productivity.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <Badge variant="outline">Why Choose Us</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Built for Teams That Value Efficiency
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Reduce Resolution Time</h4>
                    <p className="text-muted-foreground">Automated workflows and smart routing get tickets to the right technician faster.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Enterprise Security</h4>
                    <p className="text-muted-foreground">Role-based access, audit logs, and encryption keep your data protected.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Real-Time Insights</h4>
                    <p className="text-muted-foreground">Custom dashboards and reports give you visibility into every aspect of IT operations.</p>
                  </div>
                </div>
              </div>
              <Link to="/auth">
                <Button size="lg">
                  Get Started Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>

            <div className="relative">
              <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-border shadow-2xl overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-4 p-8">
                    <div className="h-16 w-16 mx-auto rounded-xl bg-primary flex items-center justify-center">
                      <BarChart3 className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">Interactive Dashboard</h3>
                    <p className="text-muted-foreground">Real-time metrics and KPIs at your fingertips</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 w-48 h-32 rounded-lg bg-card border border-border shadow-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">New Ticket</span>
                </div>
                <p className="text-xs text-muted-foreground">Network issue in Branch 2 assigned to you</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Testimonials</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Trusted by IT Teams Worldwide
            </h2>
            <p className="text-lg text-muted-foreground">
              See what our customers have to say about transforming their IT operations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="relative">
                <CardContent className="p-6 pt-8">
                  <div className="absolute -top-3 left-6">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                      ))}
                    </div>
                  </div>
                  <blockquote className="text-muted-foreground mb-6">
                    "{testimonial.quote}"
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {testimonial.author.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{testimonial.author}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}, {testimonial.company}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">
              Ready to Transform Your IT Operations?
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Join thousands of IT teams using TechPros ITSM to deliver exceptional service and manage their infrastructure efficiently.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto text-lg px-8">
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
