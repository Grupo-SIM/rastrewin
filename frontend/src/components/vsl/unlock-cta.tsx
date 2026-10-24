import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type UnlockCtaProps = {
  href: string;
  label: string;
};

export function UnlockCta({ href, label }: UnlockCtaProps) {
  return (
    <div className="mt-6 w-full max-w-[22.5rem] animate-reveal motion-reduce:animate-none sm:max-w-[25rem]">
      <Button asChild variant="rainbow" size="xl" className="w-full whitespace-normal">
        <a href={href} data-vsl-cta="">
          {label}
          <ArrowRight aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}
