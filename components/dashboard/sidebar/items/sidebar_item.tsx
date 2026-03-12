
type SidebarItemProps = {
    href: string;
    label: string;
    isActive?: boolean;
};

export default function SidebarItem( { href, label, isActive = false }: SidebarItemProps) {
    return (
        <a href={href} className={`block py-2.5 px-4  transition duration-200 ${isActive ? 'bg-[#F2F2F2] text-gray-900' : 'hover:bg-[#F2F2F2] hover:text-gray-900'}`}>
            {label}
        </a>
    );
}
