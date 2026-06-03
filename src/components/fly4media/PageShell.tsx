import { useState, type ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import ContactModal from "./ContactModal";
import { usePageEnter } from "@/hooks/usePageEnter";

type ChildArg = { openContact: () => void; openContactWithService: (service: string) => void };

interface Props {
  children: ReactNode | ((args: ChildArg) => ReactNode);
}

export default function PageShell({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [initialServices, setInitialServices] = useState<string[]>([]);
  usePageEnter();

  const openContact = () => {
    setInitialServices([]);
    setOpen(true);
  };

  const openContactWithService = (service: string) => {
    setInitialServices([service]);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setInitialServices([]);
  };

  const rendered = typeof children === "function"
    ? children({ openContact, openContactWithService })
    : children;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onContact={openContact} />
      <main>{rendered}</main>
      <Footer onContact={openContact} />
      <ContactModal open={open} onClose={handleClose} initialServices={initialServices} />
    </div>
  );
}
