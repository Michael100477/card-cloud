import * as React from "react";
import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Preview, Section, Text,
} from "@react-email/components";

interface PasswordResetEmailProps {
  resetUrl: string;
}

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Card Cloud password — link expires in 30 minutes.</Preview>
      <Body style={body}>
        <Container style={container}>

          {/* Navy header */}
          <Section style={header}>
            <Text style={logo}>☁ The Card Cloud</Text>
          </Section>

          {/* Body */}
          <Section style={content}>
            <Heading style={h1}>Reset your password</Heading>

            <Text style={paragraph}>
              We received a request to reset the password for your account.
              Click the button below to choose a new one.
            </Text>

            <Button style={button} href={resetUrl}>
              Reset my password
            </Button>

            <Text style={expiry}>
              This link expires in <strong>30 minutes</strong>.
            </Text>

            <Hr style={hr} />

            <Text style={paragraph}>
              If you didn&apos;t request a password reset, you can safely ignore this
              email — your password hasn&apos;t been changed.
            </Text>

            <Text style={smallText}>
              For security, never share this link with anyone. The Card Cloud will
              never ask for your password by email.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              © 2026 The Card Cloud · You received this because a reset was requested for your account.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

export default PasswordResetEmail;

// ─── Styles ───────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "32px auto",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 4px 24px rgba(4,44,83,0.10)",
};

const header: React.CSSProperties = {
  backgroundColor: "#042C53",
  padding: "24px 32px",
};

const logo: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "700",
  margin: "0",
};

const content: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "32px",
};

const h1: React.CSSProperties = {
  color: "#042C53",
  fontSize: "24px",
  fontWeight: "700",
  margin: "0 0 16px",
};

const paragraph: React.CSSProperties = {
  color: "#475569",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const button: React.CSSProperties = {
  backgroundColor: "#EF9F27",
  color: "#412402",
  fontWeight: "700",
  fontSize: "15px",
  padding: "14px 28px",
  borderRadius: "12px",
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "16px",
};

const expiry: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "13px",
  margin: "0 0 24px",
};

const hr: React.CSSProperties = {
  borderColor: "#e2e8f0",
  margin: "24px 0",
};

const smallText: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0",
};

const footerSection: React.CSSProperties = {
  backgroundColor: "#042C53",
  padding: "16px 32px",
};

const footerText: React.CSSProperties = {
  color: "rgba(255,255,255,0.35)",
  fontSize: "11px",
  textAlign: "center",
  margin: "0",
};
