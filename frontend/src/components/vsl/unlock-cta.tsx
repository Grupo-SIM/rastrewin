import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type UnlockCtaProps = {
  href: string;
  label: string;
};

export function UnlockCta({ href, label }: UnlockCtaProps) {
  return (
    <div className="mt-5 flex w-full animate-reveal justify-center motion-reduce:animate-none">
      <Button asChild variant="rainbow-spin" size="xl" className="max-w-full whitespace-normal">
        <a href={href} data-vsl-cta="">
          {label}
          <ArrowRight aria-hidden="true" className="animate-nudge motion-reduce:animate-none" />
        </a>
      </Button>
    </div>
  );
}
