import { SignatureStatus as SignatureStatusType } from '../types/storage';
import { formatSignatureDisplay } from '../utils/signature';
import { shortenAddress } from '../utils/address';

interface SignatureStatusProps {
  status: SignatureStatusType;
  signedBy?: string;
  signedAt?: Date;
  signature?: string;
  className?: string;
}

export default function SignatureStatus({
  status,
  signedBy,
  signedAt,
  signature,
  className = '',
}: SignatureStatusProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'signed':
        return '✅';
      case 'pending':
        return '🔘';
      case 'mismatch':
        return '❌';
      case 'unverifiable':
        return '⚠️';
      default:
        return '❓';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'signed':
        return `Signed by ${shortenAddress(signedBy || '')} on ${signedAt?.toLocaleDateString()}`;
      case 'pending':
        return 'Pending verification';
      case 'mismatch':
        return 'Signature mismatch';
      case 'unverifiable':
        return 'Cannot verify — no signature';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'signed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'mismatch':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'unverifiable':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()} ${className}`}>
      <div className="flex items-start space-x-3">
        <span className="text-xl">{getStatusIcon()}</span>
        <div className="flex-1">
          <p className="font-medium">{getStatusText()}</p>
          {status === 'signed' && signature && (
            <p className="mt-1 text-sm font-mono opacity-75">
              Signature: {formatSignatureDisplay(signature)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 