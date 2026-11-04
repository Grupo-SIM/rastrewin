import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnlockCtaProps {
	href: string;
	label: string;
	className?: string;
}

export function UnlockCta({ href, label, className }: UnlockCtaProps) {
	return (
		<div
			className={cn(
				"animate-reveal mt-5 flex w-full justify-center motion-reduce:animate-none",
				className,
			)}
		>
			<Button asChild variant="rainbow-spin" size="xl" className="max-w-full whitespace-normal">
				<a href={href} data-vsl-cta="">
					{label}
					<ArrowRight aria-hidden="true" className="animate-nudge motion-reduce:animate-none" />
				</a>
			</Button>
		</div>
	);
}
