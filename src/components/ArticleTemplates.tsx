import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Code, Settings, Users, Shield, BookOpen } from "lucide-react";

interface ArticleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  template: {
    title: string;
    content: string;
    category: string;
    tags: string[];
  };
}

const articleTemplates: ArticleTemplate[] = [
  {
    id: "troubleshooting",
    name: "Troubleshooting Guide",
    description: "Step-by-step troubleshooting procedure",
    category: "Troubleshooting",
    icon: <Settings className="h-5 w-5" />,
    template: {
      title: "How to Troubleshoot [Issue]",
      content: `# Problem Description

Describe the issue in detail...

## Symptoms
- Symptom 1
- Symptom 2
- Symptom 3

## Troubleshooting Steps

### Step 1: Initial Diagnosis
1. Check basic connectivity
2. Verify system status
3. Review recent changes

### Step 2: Common Solutions
1. **Solution A**: Description and steps
2. **Solution B**: Alternative approach

### Step 3: Advanced Troubleshooting
- Check logs for errors
- Verify configuration settings
- Test with alternative methods

## Resolution
Document the final solution...

## Prevention
Tips to avoid this issue in the future...

## Related Articles
- Link to related KB articles
- Reference documentation`,
      category: "Troubleshooting",
      tags: ["troubleshooting", "guide", "support"]
    }
  },
  {
    id: "procedure",
    name: "Standard Operating Procedure",
    description: "Documented process or workflow",
    category: "Procedures",
    icon: <BookOpen className="h-5 w-5" />,
    template: {
      title: "SOP: [Process Name]",
      content: `# Standard Operating Procedure: [Process Name]

## Purpose
Brief description of what this procedure accomplishes...

## Scope
- What systems/processes this applies to
- Who should follow this procedure
- When this procedure should be used

## Prerequisites
- Required permissions/access
- Tools or software needed
- Knowledge requirements

## Procedure Steps

### Preparation
1. Gather required materials
2. Verify access permissions
3. Backup current configuration

### Execution
1. **Step 1**: Detailed instructions
   - Sub-step details
   - Expected outcomes

2. **Step 2**: Continue with next phase
   - Verification points
   - Error handling

3. **Step 3**: Final steps
   - Validation
   - Documentation

### Verification
- How to confirm the procedure was successful
- Expected results
- Testing methods

## Exception Handling
- Common issues and solutions
- When to escalate
- Contact information

## Related Documents
- Reference materials
- Related procedures
- Training resources

## Revision History
- Version 1.0 - Initial creation
- Version 1.1 - Updated procedure steps`,
      category: "Procedures",
      tags: ["sop", "procedure", "workflow"]
    }
  },
  {
    id: "technical-spec",
    name: "Technical Specification",
    description: "Technical details and specifications",
    category: "Technical",
    icon: <Code className="h-5 w-5" />,
    template: {
      title: "Technical Specification: [Component/System]",
      content: `# Technical Specification: [Component/System]

## Overview
High-level description of the component or system...

## Architecture
- System components
- Data flow diagram
- Integration points

## Technical Requirements

### Hardware Requirements
- Minimum specifications
- Recommended configuration
- Supported platforms

### Software Requirements
- Operating system compatibility
- Required software dependencies
- Version requirements

## Configuration

### Default Settings
\`\`\`json
{
  "setting1": "value1",
  "setting2": "value2"
}
\`\`\`

### Custom Configuration
Instructions for modifying settings...

## API Reference

### Endpoints
- \`GET /api/resource\` - Retrieve resource
- \`POST /api/resource\` - Create resource

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| param1 | string | Yes | Description |
| param2 | number | No | Description |

## Security Considerations
- Authentication requirements
- Data protection measures
- Access control

## Performance
- Expected throughput
- Latency requirements
- Scalability considerations

## Monitoring
- Key metrics to monitor
- Alert thresholds
- Troubleshooting guides

## Deployment
- Installation instructions
- Configuration steps
- Validation procedures`,
      category: "Technical",
      tags: ["technical", "specification", "api"]
    }
  },
  {
    id: "user-guide",
    name: "User Guide",
    description: "End-user documentation and tutorials",
    category: "User Guides",
    icon: <Users className="h-5 w-5" />,
    template: {
      title: "User Guide: [Feature/Application]",
      content: `# User Guide: [Feature/Application]

## Introduction
Welcome to [Feature/Application]! This guide will help you get started and make the most of its features.

## Getting Started

### Prerequisites
- Account requirements
- System requirements
- Access permissions

### Installation/Setup
1. Download the application
2. Run the installer
3. Configure initial settings

## Basic Usage

### First Time Setup
1. Launch the application
2. Sign in with your credentials
3. Complete the welcome wizard

### Main Features

#### Feature 1: [Feature Name]
Description of the feature and its purpose.

**How to use:**
1. Navigate to the feature section
2. Click the action button
3. Follow the on-screen prompts

#### Feature 2: [Feature Name]
Description of another key feature.

## Advanced Features

### Custom Configuration
- How to customize settings
- Advanced options
- Personalization tips

### Integration
- Connecting with other systems
- API usage
- Third-party integrations

## Troubleshooting

### Common Issues
- Issue 1: Solution description
- Issue 2: Solution description

### Getting Help
- Support contact information
- Community forums
- Knowledge base resources

## Best Practices
- Usage recommendations
- Performance tips
- Security guidelines

## Frequently Asked Questions

**Q: How do I reset my password?**
A: Click "Forgot Password" on the login screen...

**Q: Can I export my data?**
A: Yes, go to Settings > Export...

## Glossary
- **Term 1**: Definition
- **Term 2**: Definition`,
      category: "User Guides",
      tags: ["user-guide", "tutorial", "documentation"]
    }
  },
  {
    id: "security-policy",
    name: "Security Policy",
    description: "Security procedures and policies",
    category: "Security",
    icon: <Shield className="h-5 w-5" />,
    template: {
      title: "Security Policy: [Policy Name]",
      content: `# Security Policy: [Policy Name]

## Purpose
This policy establishes guidelines for [specific security area] to protect organizational assets and ensure compliance.

## Scope
This policy applies to:
- All employees and contractors
- All company systems and data
- All locations and remote access

## Policy Statement

### Key Principles
1. **Confidentiality**: Protect sensitive information
2. **Integrity**: Ensure data accuracy and reliability
3. **Availability**: Maintain system accessibility

### Responsibilities

#### Employees
- Follow security procedures
- Report security incidents
- Maintain password security

#### IT Security Team
- Implement security controls
- Monitor for threats
- Respond to incidents

#### Management
- Provide resources for security
- Ensure policy compliance
- Review and update policies

## Security Controls

### Access Control
- Multi-factor authentication required
- Least privilege principle
- Regular access reviews

### Data Protection
- Encryption standards
- Data classification
- Backup procedures

### Incident Response
- Reporting procedures
- Response team contacts
- Recovery processes

## Compliance Requirements
- Industry standards (ISO 27001, NIST, etc.)
- Regulatory requirements
- Audit requirements

## Enforcement
- Policy violations and consequences
- Monitoring and auditing
- Review and update procedures

## Related Policies
- Password Policy
- Data Classification Policy
- Incident Response Policy

## Revision History
| Version | Date | Changes |
|---------|------|---------|
| 1.0 | [Date] | Initial creation |
| 1.1 | [Date] | Updated requirements |`,
      category: "Security",
      tags: ["security", "policy", "compliance"]
    }
  }
];

interface ArticleTemplatesProps {
  onSelectTemplate: (template: ArticleTemplate['template']) => void;
}

export default function ArticleTemplates({ onSelectTemplate }: ArticleTemplatesProps) {
  const categories = [...new Set(articleTemplates.map(t => t.category))];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Article Templates</h3>
        <p className="text-sm text-muted-foreground">
          Choose a template to quickly create standardized knowledge base articles
        </p>
      </div>

      {categories.map(category => (
        <div key={category} className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            {category}
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {articleTemplates
              .filter(template => template.category === category)
              .map(template => (
                <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {template.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => onSelectTemplate(template.template)}
                        className="text-xs"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { articleTemplates };
export type { ArticleTemplate };