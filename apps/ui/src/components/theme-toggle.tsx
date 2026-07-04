import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/theme-provider';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    function toggle() {
        const prefersDark = window.matchMedia(
            '(prefers-color-scheme: dark)'
        ).matches;
        const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
        setTheme(isDark ? 'light' : 'dark');
    }

    return (
        <Button onClick={toggle} aria-label="Toggle theme">
            <span className="dark:hidden">Dark</span>
            <span className="hidden dark:inline">Light</span>
        </Button>
    );
}
