import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";

const buttonVariants = cva(
	"focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		defaultVariants: {
			size: "default",
			variant: "default",
		},
		variants: {
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				icon: "size-9",
				"icon-lg": "size-10",
				"icon-sm": "size-8",
				"icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
				// Responde à largura da coluna (@container no pai), não à da tela.
				xl: "min-h-12 gap-2 px-6 py-2 text-[0.9375rem] @xs:text-base [&_svg:not([class*='size-'])]:size-[1.125rem]",
				xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
			},
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				destructive:
					"bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white",
				ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
				link: "text-primary underline-offset-4 hover:underline",
				outline:
					"bg-background hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 border shadow-xs",
				// Botão-assinatura da Rastrewin: fundo branco com borda no gradiente da marca.
				rainbow:
					"text-ink shadow-brand focus-visible:ring-ring/70 rounded-full border-[3px] border-transparent font-semibold [background:linear-gradient(#fff,#fff)_padding-box,var(--rainbow)_border-box] hover:-translate-y-px focus-visible:border-transparent focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
				// Mesmo botão, com a borda girando (CTA principal).
				"rainbow-spin":
					"rainbow-border-spin text-ink shadow-brand focus-visible:ring-ring/70 rounded-full border-[3px] border-transparent font-semibold hover:-translate-y-px focus-visible:border-transparent focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
				secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
			},
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ className, size, variant }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
