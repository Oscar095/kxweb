-- Crear tabla dbo.pedidos (checkout)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pedidos]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.pedidos (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nit_id NVARCHAR(60) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) NOT NULL,
    phone NVARCHAR(100) NOT NULL,
    address NVARCHAR(255) NOT NULL,
    city NVARCHAR(120) NOT NULL,
    notes NVARCHAR(MAX) NULL,
    payment_method NVARCHAR(50) NULL,
    createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
  );
END
