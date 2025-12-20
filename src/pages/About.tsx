import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/landing/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Eye,
  Heart,
  Users,
  Globe,
  Award,
  ArrowRight,
  Lightbulb,
  Shield,
  Zap,
} from "lucide-react";

export default function About() {
  const values = [
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "We continuously push boundaries to deliver cutting-edge solutions that solve real problems.",
    },
    {
      icon: Heart,
      title: "Customer Focus",
      description: "Every decision we make starts with how it will benefit our customers and their teams.",
    },
    {
      icon: Shield,
      title: "Reliability",
      description: "We build systems that work 24/7, because your IT operations never sleep.",
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "We believe great software comes from diverse teams working together openly.",
    },
  ];

  const stats = [
    { value: "2019", label: "Founded" },
    { value: "50+", label: "Team Members" },
    { value: "1000+", label: "Happy Customers" },
    { value: "25+", label: "Countries Served" },
  ];

  const team = [
    {
      name: "Alex Thompson",
      role: "CEO & Co-Founder",
      bio: "Former IT Director with 15+ years in enterprise IT management.",
    },
    {
      name: "Sarah Chen",
      role: "CTO & Co-Founder",
      bio: "Ex-Google engineer passionate about building scalable systems.",
    },
    {
      name: "Michael Rodriguez",
      role: "VP of Product",
      bio: "Product leader focused on creating intuitive user experiences.",
    },
    {
      name: "Emily Watson",
      role: "VP of Customer Success",
      bio: "Dedicated to ensuring every customer achieves their IT goals.",
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
              Our Story
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Building the Future of IT Service Management
            </h1>
            <p className="text-lg text-muted-foreground">
              We're on a mission to help IT teams deliver exceptional service and manage their infrastructure with confidence.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <Card className="border-primary/20">
              <CardContent className="p-8">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">Our Mission</h3>
                <p className="text-muted-foreground">
                  To empower IT teams worldwide with intuitive, powerful tools that streamline operations, reduce resolution times, and enable them to focus on what matters most: solving problems and driving innovation.
                </p>
              </CardContent>
            </Card>

            <Card className="border-accent/20">
              <CardContent className="p-8">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-6">
                  <Eye className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">Our Vision</h3>
                <p className="text-muted-foreground">
                  To become the global standard for IT service management, known for combining enterprise-grade capabilities with an experience so intuitive that teams can be productive from day one.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-card border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">Our Story</Badge>
              <h2 className="text-3xl font-bold text-foreground">
                From Frustration to Innovation
              </h2>
            </div>
            
            <div className="prose prose-lg max-w-none text-muted-foreground space-y-6">
              <p>
                TechPros ITSM was born in 2019 from a simple observation: IT teams were drowning in complexity. Our founders, having spent decades in enterprise IT, saw firsthand how legacy ITSM tools were failing the people who needed them most.
              </p>
              <p>
                Existing solutions were either too expensive, too complicated, or too rigid. Small and mid-sized organizations were forced to choose between enterprise tools they couldn't afford or spreadsheets that couldn't scale. We knew there had to be a better way.
              </p>
              <p>
                So we set out to build an ITSM platform that combines the power of enterprise solutions with the simplicity of modern consumer apps. A tool that IT teams would actually want to use, not one they were forced to endure.
              </p>
              <p>
                Today, TechPros ITSM serves over 1,000 organizations across 25 countries, helping IT teams manage millions of tickets, track thousands of assets, and deliver better service every single day.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Our Values</Badge>
            <h2 className="text-3xl font-bold text-foreground">
              What We Stand For
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {values.map((value, index) => (
              <Card key={index}>
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <value.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Leadership</Badge>
            <h2 className="text-3xl font-bold text-foreground">
              Meet Our Team
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {team.map((member, index) => (
              <Card key={index}>
                <CardContent className="p-6 text-center">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{member.name}</h3>
                  <p className="text-sm text-primary mb-2">{member.role}</p>
                  <p className="text-sm text-muted-foreground">{member.bio}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Global Presence */}
      <section className="py-24 bg-card border-y border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Serving Teams Globally
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              From San Francisco to Singapore, Sydney to Stockholm, TechPros ITSM helps IT teams across 25+ countries deliver exceptional service. Our platform supports multiple languages and time zones, ensuring your team can work effectively wherever they are.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Badge variant="outline" className="px-4 py-2">North America</Badge>
              <Badge variant="outline" className="px-4 py-2">Europe</Badge>
              <Badge variant="outline" className="px-4 py-2">Asia Pacific</Badge>
              <Badge variant="outline" className="px-4 py-2">Middle East</Badge>
              <Badge variant="outline" className="px-4 py-2">Africa</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">
              Join the TechPros Family
            </h2>
            <p className="text-lg text-muted-foreground">
              Be part of our mission to transform IT service management. Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
