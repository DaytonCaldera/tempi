
type SidebarItemProps = {
    href: string;
    label: string;
    isActive?: boolean;
};

export default function SidebarItem( { href, label, isActive = false }: SidebarItemProps) {
    return (
        <a href={href} className={`block py-2.5 px-4  transition duration-200 ${isActive ? 'bg-[#DEE7F7] text-gray-900' : 'hover:bg-[#DEE7F7] hover:text-gray-900'}`}>
            {label}
        </a>
    );
}
