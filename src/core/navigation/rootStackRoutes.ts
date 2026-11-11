export type RootStackRouteConfig = {
  name: string;
  options: {
    headerShown: boolean;
    title?: string;
  };
};

export const rootStackRoutes: RootStackRouteConfig[] = [
  {
    name: '(drawer)',
    options: { headerShown: false },
  },
  {
    name: 'supplier/new',
    options: {
      headerShown: true,
      title: 'Nuevo proveedor',
    },
  },
  {
    name: 'supplier/[id]',
    options: {
      headerShown: true,
      title: 'Editar proveedor',
    },
  },
  {
    name: 'logistics/history',
    options: {
      headerShown: true,
      title: 'Historial de movimientos',
    },
  },
];
