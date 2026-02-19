interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const logoSrc = '/arriendos/images/logo.png'

  const imageClasses = {
    sm: 'h-8 w-auto',
    md: 'h-10 w-auto',
    lg: 'h-24 w-auto',
  }

  const textSizes = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-3xl',
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img
        src={logoSrc}
        alt="YNK Logo"
        className={`${imageClasses[size]} object-contain`}
      />
      {showText && (
        <div>
          <h1 className={`${textSizes[size]} font-bold text-gray-900`}>
            Gestor de Arriendos
          </h1>
          {size === 'md' && (
            <p className="text-xs text-gray-500">YNK</p>
          )}
        </div>
      )}
    </div>
  )
}
