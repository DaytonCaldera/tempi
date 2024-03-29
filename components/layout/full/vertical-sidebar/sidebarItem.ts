import {
    ApertureIcon,
    CopyIcon,
    LayoutDashboardIcon, LoginIcon, MoodHappyIcon, TypographyIcon, UserPlusIcon, TableIcon
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
        title: 'Personal y tareas',
        icon: TypographyIcon,
        to: '/personal'
    },
    { header: 'Predicacion' },
    {
        title: 'Puntos y territorios',
        icon: UserPlusIcon,
        to: '/puntos-territorios'
    },
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
    {header:'Administracion'},
    {
        title:'Diccionarios de datos',
        icon:TableIcon,
        to:'/diccionario'
    }
];

export default sidebarItem;
