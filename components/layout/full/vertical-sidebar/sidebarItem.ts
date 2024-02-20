import {
    ApertureIcon,
    CopyIcon,
    LayoutDashboardIcon, LoginIcon, MoodHappyIcon, TypographyIcon, UserPlusIcon
} from 'vue-tabler-icons';

export interface menu {
    header?: string;
    title?: string;
    icon?: any;
    to?: string;
    chip?: string;
    chipColor?: string;
    chipVariant?: string;
    chipIcon?: string;
    children?: menu[];
    disabled?: boolean;
    type?: string;
    subCaption?: string;
}

const sidebarItem: menu[] = [
    {
        title: 'Inicio',
        icon: LayoutDashboardIcon,
        to: '/'
    },
    { header: 'Publicadores' },
    {
        title: 'Grupos',
        icon: TypographyIcon,
        to: '/grupos'
    },
    {
        title: 'Publicadores',
        icon: CopyIcon,
        to: '/publicadores'
    },
    {
        title: 'Conductores',
        icon: LoginIcon,
        to: '/conductores'
    },
    { header: 'Predicacion' },
    {
        title: 'Territorios',
        icon: UserPlusIcon,
        to: '/territorios'
    },
    {
        title: 'Puntos de salida',
        icon: MoodHappyIcon,
        to: '/puntos'
    },
    {
        title: 'Fracciones',
        icon: ApertureIcon,
        to: '/fracciones'
    },
    { header: 'Programa' },
    {
        title: 'Registro (S-13)',
        icon: ApertureIcon,
        to: '/registro-predicacion'
    },
    {
        title: 'Programa predicacion',
        icon: ApertureIcon,
        to: '/programa-predicacion'
    },
];

export default sidebarItem;
