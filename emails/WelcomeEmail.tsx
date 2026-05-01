import * as React from "react";
import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Img,
} from "@react-email/components";

interface WelcomeEmailProps {
  username: string;
  loginUrl?: string;
}

export function WelcomeEmail({
  username,
  loginUrl = "https://thecardcloud.com/dashboard",
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to The Card Cloud, {username} — your collection home is ready.</Preview>
      <Body style={body}>
        <Container style={container}>

          {/* Navy header */}
          <Section style={header}>
            <Text style={logo}>☁ The Card Cloud</Text>
          </Section>

          {/* Body */}
          <Section style={content}>
            <Heading style={h1}>Welcome, @{username}!</Heading>

            <Text style={paragraph}>
              Your account is set up and your free 30-day trial has started. You can
              track up to unlimited cards right now — no credit card needed.
            </Text>

            <Text style={paragraph}>Here&apos;s what you can do from day one:</Text>

            <Section style={featureList}>
              <Text style={featureItem}>📈 <strong>Track your collection</strong> — add cards and see live eBay values</Text>
              <Text style={featureItem}>💵 <strong>Get a cash offer</strong> — submit any card for a personal offer</Text>
              <Text style={featureItem}>🏷 <strong>Consign on eBay</strong> — we list and pay you when it sells</Text>
              <Text style={featureItem}>🔄 <strong>Trade safely</strong> — swap cards using us as escrow</Text>
            </Section>

            <Button style={button} href={loginUrl}>
              Go to my collection
            </Button>

            <Hr style={hr} />

            <Text style={footer}>
              Questions? Just reply to this email — we&apos;re real people and we actually read these.
            </Text>
            <Text style={footer}>
              — The Card Cloud Team
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              © 2026 The Card Cloud · You received this because you created an account.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;

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

const featureList: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "0 0 24px",
};

const featureItem: React.CSSProperties = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 8px",
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
};

const hr: React.CSSProperties = {
  borderColor: "#e2e8f0",
  margin: "28px 0",
};

const footer: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 6px",
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
