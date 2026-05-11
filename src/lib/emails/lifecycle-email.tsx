import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
} from '@react-email/components';
import { FINANCIAL_DISCLAIMER_TEXT } from '@/components/legal/financial-disclaimer';

interface LifecycleEmailProps {
    preview: string;
    title: string;
    intro: string;
    bullets?: string[];
    ctaLabel: string;
    ctaUrl: string;
    footer?: string;
}

export function LifecycleEmail({
    preview,
    title,
    intro,
    bullets = [],
    ctaLabel,
    ctaUrl,
    footer = 'RutaCero sigue usando el email como canal base mientras medimos la mejor siguiente capa de recordatorios.',
}: LifecycleEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>{preview}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Heading style={logo}>RutaCero</Heading>
                    </Section>
                    <Section style={content}>
                        <Heading style={headline}>{title}</Heading>
                        <Text style={paragraph}>{intro}</Text>
                        {bullets.length > 0 ? (
                            <Section style={listContainer}>
                                {bullets.map((bullet) => (
                                    <Text key={bullet} style={listItem}>
                                        - {bullet}
                                    </Text>
                                ))}
                            </Section>
                        ) : null}
                        <Section style={buttonContainer}>
                            <Button style={button} href={ctaUrl}>
                                {ctaLabel}
                            </Button>
                        </Section>
                        <Hr style={hr} />
                        <Text style={footerText}>{footer}</Text>
                        <Text style={disclaimerText}>{FINANCIAL_DISCLAIMER_TEXT}</Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

const main = {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
    margin: '0 auto',
    padding: '20px 0',
    maxWidth: '580px',
};

const header = {
    backgroundColor: '#18181b',
    borderRadius: '12px 12px 0 0',
    padding: '24px',
    textAlign: 'center' as const,
};

const logo = {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '700',
    margin: '0',
};

const content = {
    backgroundColor: '#ffffff',
    padding: '32px 24px',
    borderRadius: '0 0 12px 12px',
};

const headline = {
    color: '#18181b',
    fontSize: '24px',
    fontWeight: '600',
    margin: '0 0 16px 0',
};

const paragraph = {
    color: '#52525b',
    fontSize: '16px',
    lineHeight: '24px',
    margin: '0 0 18px 0',
};

const listContainer = {
    backgroundColor: '#f4f4f5',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '24px',
};

const listItem = {
    color: '#27272a',
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0 0 8px 0',
};

const buttonContainer = {
    marginBottom: '24px',
};

const button = {
    backgroundColor: '#18181b',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
};

const hr = {
    borderColor: '#e4e4e7',
    margin: '24px 0 16px 0',
};

const footerText = {
    color: '#71717a',
    fontSize: '13px',
    lineHeight: '20px',
    margin: '0',
};

const disclaimerText = {
    color: '#a1a1aa',
    fontSize: '11px',
    lineHeight: '16px',
    borderTop: '1px solid #e4e4e7',
    paddingTop: '12px',
    marginTop: '16px',
};
