import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Section,
    Text,
    Button,
    Hr,
} from '@react-email/components';
import { FINANCIAL_DISCLAIMER_TEXT } from '@/components/legal/financial-disclaimer';

interface PaymentReminderEmailProps {
    userName?: string;
    debts: Array<{
        creditor: string;
        amount: number;
        currency: string;
        dueDate: string;
        daysUntilDue: number;
    }>;
    dashboardUrl: string;
}

export function PaymentReminderEmail({
    userName = 'Usuario',
    debts,
    dashboardUrl,
}: PaymentReminderEmailProps) {
    const totalAmount = debts.reduce((sum, debt) => sum + debt.amount, 0);
    const currency = debts[0]?.currency || 'GTQ';

    const formatCurrency = (amount: number, curr: string) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: curr,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <Html>
            <Head />
            <Preview>
                {debts.length === 1
                    ? `Recordatorio: Tu pago de ${debts[0].creditor} vence pronto`
                    : `Recordatorio: ${debts.length} pagos próximos por ${formatCurrency(totalAmount, currency)}`
                }
            </Preview>
            <Body style={main}>
                <Container style={container}>
                    {/* Header */}
                    <Section style={header}>
                        <Heading style={logo}>RutaCero</Heading>
                    </Section>

                    {/* Content */}
                    <Section style={content}>
                        <Heading style={h1}>
                            ¡Hola{userName ? `, ${userName}` : ''}! 👋
                        </Heading>

                        <Text style={paragraph}>
                            Te recordamos que tienes {debts.length === 1 ? 'un pago' : `${debts.length} pagos`} próximos:
                        </Text>

                        {/* Debts table */}
                        <Section style={tableContainer}>
                            {debts.map((debt, index) => (
                                <Section key={index} style={debtRow}>
                                    <Text style={debtCreditor}>{debt.creditor}</Text>
                                    <Text style={debtAmount}>
                                        {formatCurrency(debt.amount, debt.currency)}
                                    </Text>
                                    <Text style={debtDueDate}>
                                        {debt.daysUntilDue === 0
                                            ? '🔴 Vence hoy'
                                            : debt.daysUntilDue === 1
                                                ? '🟠 Vence mañana'
                                                : `📅 Vence en ${debt.daysUntilDue} días`
                                        }
                                    </Text>
                                </Section>
                            ))}
                        </Section>

                        {/* Summary */}
                        <Section style={summary}>
                            <Text style={summaryText}>
                                Total a pagar: <strong>{formatCurrency(totalAmount, currency)}</strong>
                            </Text>
                        </Section>

                        {/* CTA */}
                        <Section style={buttonContainer}>
                            <Button style={button} href={dashboardUrl}>
                                Ver mis deudas
                            </Button>
                        </Section>

                        <Hr style={hr} />

                        {/* Tips */}
                        <Text style={tipText}>
                            💡 <strong>Tip:</strong> Pagar a tiempo te ayuda a evitar cargos por mora y
                            mejora tu historial crediticio.
                        </Text>
                    </Section>

                    {/* Footer */}
                    <Section style={footer}>
                        <Text style={footerText}>
                            Este mensaje fue enviado por RutaCero.
                            <br />
                            <Link href={`${dashboardUrl}/settings`} style={footerLink}>
                                Gestionar preferencias de email
                            </Link>
                        </Text>
                        <Text style={disclaimerText}>{FINANCIAL_DISCLAIMER_TEXT}</Text>
                        <Text style={footerCopyright}>
                            © {new Date().getFullYear()} RutaCero. Guatemala.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

// Styles
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
};

const h1 = {
    color: '#18181b',
    fontSize: '24px',
    fontWeight: '600',
    margin: '0 0 16px 0',
};

const paragraph = {
    color: '#52525b',
    fontSize: '16px',
    lineHeight: '24px',
    margin: '0 0 24px 0',
};

const tableContainer = {
    marginBottom: '24px',
};

const debtRow = {
    backgroundColor: '#f4f4f5',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '8px',
};

const debtCreditor = {
    color: '#18181b',
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 4px 0',
};

const debtAmount = {
    color: '#18181b',
    fontSize: '20px',
    fontWeight: '700',
    margin: '0 0 4px 0',
};

const debtDueDate = {
    color: '#71717a',
    fontSize: '14px',
    margin: '0',
};

const summary = {
    backgroundColor: '#18181b',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
};

const summaryText = {
    color: '#ffffff',
    fontSize: '18px',
    margin: '0',
    textAlign: 'center' as const,
};

const buttonContainer = {
    textAlign: 'center' as const,
    marginBottom: '24px',
};

const button = {
    backgroundColor: '#f59e0b',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    padding: '12px 32px',
    textDecoration: 'none',
};

const hr = {
    borderColor: '#e4e4e7',
    margin: '24px 0',
};

const tipText = {
    color: '#52525b',
    fontSize: '14px',
    lineHeight: '20px',
    margin: '0',
};

const footer = {
    backgroundColor: '#fafafa',
    borderRadius: '0 0 12px 12px',
    padding: '24px',
    textAlign: 'center' as const,
};

const footerText = {
    color: '#71717a',
    fontSize: '12px',
    lineHeight: '20px',
    margin: '0 0 8px 0',
};

const footerLink = {
    color: '#f59e0b',
    textDecoration: 'underline',
};

const footerCopyright = {
    color: '#a1a1aa',
    fontSize: '11px',
    margin: '0',
};

const disclaimerText = {
    color: '#a1a1aa',
    fontSize: '11px',
    lineHeight: '16px',
    borderTop: '1px solid #e4e4e7',
    paddingTop: '12px',
    marginTop: '12px',
    textAlign: 'left' as const,
};

export default PaymentReminderEmail;
