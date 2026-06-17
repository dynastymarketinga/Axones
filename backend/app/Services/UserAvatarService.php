<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class UserAvatarService
{
    private const DISK = 'public';

    private const DIRECTORY = 'avatars';

    private const SIZE = 256;

    public function store(User $user, UploadedFile $file): User
    {
        $this->deleteStoredFile($user);

        $path = self::DIRECTORY.'/'.$user->getKey().'.jpg';
        $binary = $this->processToSquareJpeg($file);

        Storage::disk(self::DISK)->put($path, $binary);

        $user->avatar_path = $path;
        $user->save();

        return $user->fresh();
    }

    public function destroy(User $user): User
    {
        $this->deleteStoredFile($user);
        $user->avatar_path = null;
        $user->save();

        return $user->fresh();
    }

    private function deleteStoredFile(User $user): void
    {
        $path = (string) ($user->avatar_path ?? '');
        if ($path === '') {
            return;
        }

        $disk = Storage::disk(self::DISK);
        if ($disk->exists($path)) {
            $disk->delete($path);
        }
    }

    private function processToSquareJpeg(UploadedFile $file): string
    {
        if (! extension_loaded('gd')) {
            throw new RuntimeException('GD no está disponible en el servidor.');
        }

        $source = $this->loadImage($file);
        if ($source === null) {
            throw new RuntimeException('No se pudo leer la imagen.');
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $side = min($width, $height);
        $srcX = (int) max(0, floor(($width - $side) / 2));
        $srcY = (int) max(0, floor(($height - $side) / 2));

        $target = imagecreatetruecolor(self::SIZE, self::SIZE);
        if ($target === false) {
            imagedestroy($source);
            throw new RuntimeException('No se pudo procesar la imagen.');
        }

        imagecopyresampled(
            $target,
            $source,
            0,
            0,
            $srcX,
            $srcY,
            self::SIZE,
            self::SIZE,
            $side,
            $side,
        );
        imagedestroy($source);

        ob_start();
        imagejpeg($target, null, 85);
        imagedestroy($target);
        $binary = ob_get_clean();

        if ($binary === false || $binary === '') {
            throw new RuntimeException('No se pudo guardar la imagen procesada.');
        }

        return $binary;
    }

    /**
     * @return resource|null
     */
    private function loadImage(UploadedFile $file)
    {
        $path = $file->getRealPath();
        if ($path === false) {
            return null;
        }

        $mime = strtolower((string) $file->getMimeType());

        return match ($mime) {
            'image/jpeg', 'image/jpg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : null,
            default => null,
        };
    }
}
