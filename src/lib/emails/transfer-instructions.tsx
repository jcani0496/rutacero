import { Html, Body, Container, Heading, Text, Section, Hr } from '@react-email/components';

export interface BankAccount {
    bank: string;
    accountType: string;
    accountNumber: string;
    accountName: string;
}

export interface TransferInstructionsProps {
    variantLabel: string;
    priceQ: number;
    accounts: BankAccount[];
    referenceCode: string;
}

export function TransferInstructions({
    variantLabel,
    priceQ,
    accounts,
    referenceCode,
}: TransferInstructionsProps) {
    return (
        <Html lang="es">
            <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5', padding: '24px' }}>
                <Container style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', maxWidth: '560px' }}>
                    <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 8px 0' }}>
                        Instrucciones de pago — {variantLabel}
                    </Heading>
                    <Text style={{ margin: '0 0 16px 0' }}>
                        Para activar tu plan PRO, deposita o transfiere el siguiente monto a una de las cuentas listadas e incluye el código de referencia. Activamos en menos de 24 horas hábiles tras recibir el comprobante.
                    </Text>
                    <Section style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', margin: '0 0 16px 0' }}>
                        <Text style={{ margin: 0 }}>
                            <strong>Monto:</strong> Q{priceQ.toFixed(2)}
                        </Text>
                        <Text style={{ margin: '4px 0 0 0' }}>
                            <strong>Código de referencia:</strong> {referenceCode}
                        </Text>
                    </Section>
                    <Heading as="h2" style={{ fontSize: '16px', margin: '0 0 8px 0' }}>
                        Cuentas disponibles
                    </Heading>
                    {accounts.map((a) => (
                        <Section key={`${a.bank}-${a.accountNumber}`} style={{ marginBottom: '12px' }}>
                            <Text style={{ margin: 0 }}>
                                <strong>{a.bank}</strong> — {a.accountType}
                            </Text>
                            <Text style={{ margin: '2px 0 0 0' }}>Cuenta: {a.accountNumber}</Text>
                            <Text style={{ margin: '2px 0 0 0' }}>A nombre de: {a.accountName}</Text>
                        </Section>
                    ))}
                    <Hr style={{ margin: '16px 0' }} />
                    <Text style={{ fontSize: '12px', color: '#64748b' }}>
                        Envía el comprobante respondiendo a este correo o desde la app, en Soporte. Si tienes dudas, escríbenos.
                    </Text>
                </Container>
            </Body>
        </Html>
    );
}

export default TransferInstructions;
