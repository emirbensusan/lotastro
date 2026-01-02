import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FilterPreset } from '@/hooks/useFilterPresets';
import { 
  Bookmark, 
  BookmarkCheck, 
  ChevronDown, 
  Plus, 
  Star, 
  Trash2, 
  X,
  Pencil
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface FilterPresetsProps<T> {
  presets: FilterPreset<T>[];
  activePreset: FilterPreset<T> | null;
  hasUnsavedChanges: boolean;
  onSavePreset: (name: string) => void;
  onLoadPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onRenamePreset: (presetId: string, newName: string) => void;
  onSetDefault: (presetId: string | null) => void;
  onClearFilters: () => void;
}

export function FilterPresets<T>({
  presets,
  activePreset,
  hasUnsavedChanges,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onRenamePreset,
  onSetDefault,
  onClearFilters,
}: FilterPresetsProps<T>) {
  const { t } = useLanguage();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
  const [presetToRename, setPresetToRename] = useState<FilterPreset<T> | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [renameValue, setRenameValue] = useState('');

  const handleSave = () => {
    if (newPresetName.trim()) {
      onSavePreset(newPresetName.trim());
      setNewPresetName('');
      setSaveDialogOpen(false);
    }
  };

  const handleDelete = () => {
    if (presetToDelete) {
      onDeletePreset(presetToDelete);
      setPresetToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleRename = () => {
    if (presetToRename && renameValue.trim()) {
      onRenamePreset(presetToRename.id, renameValue.trim());
      setPresetToRename(null);
      setRenameValue('');
      setRenameDialogOpen(false);
    }
  };

  const openRenameDialog = (preset: FilterPreset<T>) => {
    setPresetToRename(preset);
    setRenameValue(preset.name);
    setRenameDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {activePreset ? (
                <>
                  <BookmarkCheck className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {activePreset.name}
                  </span>
                  {hasUnsavedChanges && (
                    <span className="text-xs text-muted-foreground">*</span>
                  )}
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('filterPresets') || 'Presets'}</span>
                </>
              )}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {presets.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                {t('noSavedPresets') || 'No saved presets'}
              </div>
            ) : (
              presets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className="flex items-center justify-between group"
                  onClick={() => onLoadPreset(preset.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {preset.isDefault && (
                      <Star className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                    )}
                    <span className="truncate">{preset.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameDialog(preset);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetDefault(preset.isDefault ? null : preset.id);
                      }}
                    >
                      <Star className={`h-3 w-3 ${preset.isDefault ? 'fill-yellow-500' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPresetToDelete(preset.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('saveCurrentFilters') || 'Save current filters'}
            </DropdownMenuItem>
            {(activePreset || hasUnsavedChanges) && (
              <DropdownMenuItem onClick={onClearFilters}>
                <X className="h-4 w-4 mr-2" />
                {t('clearFilters') || 'Clear filters'}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Save Preset Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('saveFilterPreset') || 'Save Filter Preset'}</DialogTitle>
            <DialogDescription>
              {t('saveFilterPresetDesc') || 'Give your filter preset a name to save it for later use.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder={String(t('presetName')) || 'Preset name'}
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              {String(t('cancel'))}
            </Button>
            <Button onClick={handleSave} disabled={!newPresetName.trim()}>
              {String(t('save'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Preset Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('renamePreset') || 'Rename Preset'}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={String(t('presetName')) || 'Preset name'}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              {String(t('cancel'))}
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>
              {String(t('save'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deletePreset') || 'Delete Preset'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deletePresetConfirm') || 'Are you sure you want to delete this filter preset? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{String(t('cancel'))}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {String(t('delete'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
