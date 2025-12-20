import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/landing/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Building,
  Fuel,
  DollarSign,
  BookOpen,
  Bell,
  Settings,
  FileText,
  Calendar,
  ShoppingCart,
  Globe,
  Lock,
  TrendingUp,
} from "lucide-react";

export default function Features() {
  const coreFeatures = [
    {
      icon: Ticket,
      title: "Smart Ticket Management",
      description: "Create, track, and resolve IT tickets with ease. Features include priority levels, SLA tracking, automatic assignments, and detailed audit trails.",
      highlights: ["Auto-assignment rules", "SLA monitoring", "Priority escalation", "Comment threads"],
    },
    {
      icon: Package,
      title: "Asset Lifecycle Management",
      description: "Track every piece of hardware and software from procurement to retirement. Know what you have, where it is, and who's using it.",
      highlights: ["Asset tagging", "Warranty tracking", "Location management", "Assignment history"],
    },
    {
      icon: DollarSign,
      title: "Expense & Budget Control",
      description: "Submit, approve, and track expenses across departments. Set budgets and get alerts before overspending.",
      highlights: ["Approval workflows", "Receipt attachments", "Budget alerts", "Vendor tracking"],
    },
    {
      icon: Building,
      title: "Multi-Branch Operations",
      description: "Manage IT operations across multiple locations from a single dashboard. Each branch can have its own users, assets, and budgets.",
      highlights: ["Branch-level reporting", "Department management", "Local administrators", "Cross-branch visibility"],
    },
    {
      icon: Fuel,
      title: "Diesel & Generator Logs",
      description: "Track fuel consumption, running hours, and costs for backup generators. Perfect for organizations with power backup requirements.",
      highlights: ["Daily logging", "Cost analysis", "Consumption trends", "Stock management"],
    },
    {
      icon: BookOpen,
      title: "Knowledge Base",
      description: "Build a searchable repository of solutions, guides, and best practices. Reduce repeat tickets by empowering users to find answers.",
      highlights: ["Rich text editor", "Category organization", "Search functionality", "Article ratings"],
    },
  ];

  const additionalFeatures = [
    { icon: Calendar, title: "Event Calendar", description: "Schedule maintenance, meetings, and deadlines" },
    { icon: ShoppingCart, title: "Purchase Orders", description: "Manage procurement with approval workflows" },
    { icon: FileText, title: "Custom Reports", description: "Build drag-and-drop reports with filters" },
    { icon: Bell, title: "Smart Notifications", description: "Stay updated with real-time alerts" },
    { icon: Settings, title: "Automation Rules", description: "Automate repetitive tasks and workflows" },
    { icon: Users, title: "Role-Based Access", description: "Control who sees and does what" },
    { icon: Lock, title: "Audit Logging", description: "Track every action for compliance" },
    { icon: TrendingUp, title: "Analytics Dashboard", description: "Visual insights into IT performance" },
    { icon: Globe, title: "Vendor Management", description: "Track contracts and vendor performance" },
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
              Powerful Features
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Every Tool You Need for IT Excellence
            </h1>
            <p className="text-lg text-muted-foreground">
              TechPros ITSM combines powerful features with an intuitive interface to help your IT team deliver exceptional service.
            </p>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Core Modules</Badge>
            <h2 className="text-3xl font-bold text-foreground">
              Comprehensive ITSM Capabilities
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {coreFeatures.map((feature, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {feature.highlights.map((highlight, hIndex) => (
                      <div key={hIndex} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-muted-foreground">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">And More</Badge>
            <h2 className="text-3xl font-bold text-foreground">
              Additional Capabilities
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {additionalFeatures.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-24 bg-card border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <Badge variant="outline">Security First</Badge>
              <h2 className="text-3xl font-bold text-foreground">
                Enterprise-Grade Security
              </h2>
              <p className="text-lg text-muted-foreground">
                Your data security is our top priority. TechPros ITSM is built with industry-leading security practices and compliance standards.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="text-foreground">End-to-end encryption</span>
                </div>
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-primary" />
                  <span className="text-foreground">Role-based access control (RBAC)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="text-foreground">Complete audit trail logging</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="text-foreground">SOC 2 Type II compliant</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square max-w-md mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-border flex items-center justify-center">
                <Shield className="h-32 w-32 text-primary/30" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-foreground">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground">
              Experience all these features with a 14-day free trial. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
