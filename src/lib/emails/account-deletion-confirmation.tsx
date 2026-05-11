import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
} from '@react-email/components';

interface AccountDeletionConfirmationProps {
    executesAt: Date;
    gracePeriodDays: number;
    cancelUrl: string;
}

export function AccountDeletionConfirmation({
    executesAt,
    gracePeriodDays,
    cancelUrl,
}: AccountDeletionConfirmationProps) {
    const formattedDate = new Intl.DateTimeFormat('es-GT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Guatemala',
    }).format(executesAt);

    return (
        <Html>
            <Head />
            <Preview>Confirmamos tu solicitud de eliminacion de cuenta</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Heading style={logo}>RutaCero</Heading>
                    </Section>
                    <Section style={content}>
                        <Heading style={headline}>
                            Solicitud de eliminacion recibida
                        </Heading>
                        <Text style={paragraph}>
                            Recibimos tu solicitud para eliminar tu cuenta de RutaCero.
                            Por seguridad, mantenemos un periodo de gracia de{' '}
                            {gracePeriodDays} dias antes de ejecutar la eliminacion.
                        </Text>
                        <Section style={highlightBox}>
                            <Text style={highlightLabel}>
                                Tu cuenta y todos tus datos se eliminaran el:
                            </Text>
                            <Text style={highlightValue}>{formattedDate}</Text>
                        </Section>
                        <Text style={paragraph}>
                            Si cambias de opinion, puedes cancelar la solicitud en cualquier
                            momento antes de esa fecha desde la configuracion de tu cuenta.
                        </Text>
                        <Text style={paragraph}>
                            <a href={cancelUrl} style={linkStyle}>
                                Cancelar mi solicitud de eliminacion
                            </a>
                        </Text>
                        <Hr style={hr} />
                        <Text style={footerText}>
                            Si no fuiste tu quien solicito esta eliminacion, ingresa a tu
                            cuenta y cancela la solicitud inmediatamente. Luego cambia tu
                            contrasena y revisa la actividad reciente.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

export default AccountDeletionConfirmation;

const main = {
    backgroundColor: '#f6f9fc',
    fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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

const highlightBox = {
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    borderLeft: '3px solid #dc2626',
};

const highlightLabel = {
    color: '#7f1d1d',
    fontSize: '13px',
    margin: '0 0 6px 0',
    fontWeight: '500',
};

const highlightValue = {
    color: '#18181b',
    fontSize: '18px',
    fontWeight: '600',
    margin: '0',
};

const linkStyle = {
    color: '#2563eb',
    textDecoration: 'underline',
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
