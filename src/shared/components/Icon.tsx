import type {Icon as PhosphorIcon} from '@phosphor-icons/react/dist/lib/types';
import {ArrowClockwiseIcon} from '@phosphor-icons/react/ArrowClockwise';
import {CaretDownIcon} from '@phosphor-icons/react/CaretDown';
import {CaretLeftIcon} from '@phosphor-icons/react/CaretLeft';
import {CaretRightIcon} from '@phosphor-icons/react/CaretRight';
import {CaretUpIcon} from '@phosphor-icons/react/CaretUp';
import {CheckIcon} from '@phosphor-icons/react/Check';
import {ClipboardTextIcon} from '@phosphor-icons/react/ClipboardText';
import {ClockIcon} from '@phosphor-icons/react/Clock';
import {CopyIcon} from '@phosphor-icons/react/Copy';
import {FireIcon} from '@phosphor-icons/react/Fire';
import {FloppyDiskIcon} from '@phosphor-icons/react/FloppyDisk';
import {FunnelIcon} from '@phosphor-icons/react/Funnel';
import {GhostIcon} from '@phosphor-icons/react/Ghost';
import {GridFourIcon} from '@phosphor-icons/react/GridFour';
import {ImageIcon} from '@phosphor-icons/react/Image';
import {MagnifyingGlassIcon} from '@phosphor-icons/react/MagnifyingGlass';
import {MinusIcon} from '@phosphor-icons/react/Minus';
import {MoonIcon} from '@phosphor-icons/react/Moon';
import {PackageIcon} from '@phosphor-icons/react/Package';
import {PencilSimpleIcon} from '@phosphor-icons/react/PencilSimple';
import {PlayIcon} from '@phosphor-icons/react/Play';
import {PlusIcon} from '@phosphor-icons/react/Plus';
import {QuestionIcon} from '@phosphor-icons/react/Question';
import {ShieldWarningIcon} from '@phosphor-icons/react/ShieldWarning';
import {SlidersHorizontalIcon} from '@phosphor-icons/react/SlidersHorizontal';
import {SortAscendingIcon} from '@phosphor-icons/react/SortAscending';
import {StackIcon} from '@phosphor-icons/react/Stack';
import {SunIcon} from '@phosphor-icons/react/Sun';
import {TrashIcon} from '@phosphor-icons/react/Trash';
import {XIcon} from '@phosphor-icons/react/X';

const icons: Record<string, PhosphorIcon> = {
  'arrow-clockwise': ArrowClockwiseIcon,
  'arrow-up-az': SortAscendingIcon,
  'chevron-down': CaretDownIcon,
  'chevron-left': CaretLeftIcon,
  'chevron-right': CaretRightIcon,
  'chevron-up': CaretUpIcon,
  'clipboard-paste': ClipboardTextIcon,
  check: CheckIcon,
  clock: ClockIcon,
  copy: CopyIcon,
  'edit-2': PencilSimpleIcon,
  'edit-3': PencilSimpleIcon,
  flame: FireIcon,
  funnel: FunnelIcon,
  ghost: GhostIcon,
  'help-circle': QuestionIcon,
  image: ImageIcon,
  layers: StackIcon,
  'layout-grid': GridFourIcon,
  minus: MinusIcon,
  moon: MoonIcon,
  'package-open': PackageIcon,
  plus: PlusIcon,
  'refresh-ccw': ArrowClockwiseIcon,
  rocket: PlayIcon,
  save: FloppyDiskIcon,
  search: MagnifyingGlassIcon,
  'shield-alert': ShieldWarningIcon,
  'sliders-horizontal': SlidersHorizontalIcon,
  sun: SunIcon,
  trash: TrashIcon,
  'trash-2': TrashIcon,
  'wand-2': SlidersHorizontalIcon,
  x: XIcon,
};

export function Icon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const Glyph = icons[name] || QuestionIcon;
  return <Glyph aria-hidden="true" className={className} weight="bold" />;
}
