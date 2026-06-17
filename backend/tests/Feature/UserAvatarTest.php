<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UserAvatarTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_login_includes_avatar_url_when_set(): void
    {
        $user = User::factory()->create([
            'username' => 'avatar_user',
            'password' => 'password123',
            'avatar_path' => 'avatars/99.jpg',
        ]);
        Storage::disk('public')->put('avatars/99.jpg', 'fake-image');

        $this->postJson('/api/auth/login', [
            'login' => 'avatar_user',
            'password' => 'password123',
        ])
            ->assertOk()
            ->assertJsonPath('user.avatar_url', '/storage/avatars/99.jpg');
    }

    public function test_user_can_upload_avatar(): void
    {
        $user = User::factory()->create(['username' => 'uploader']);
        $token = $user->createToken('t')->plainTextToken;

        $file = UploadedFile::fake()->image('photo.jpg', 400, 300);

        $this->postJson('/api/user/avatar', ['avatar' => $file], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('user.id', $user->getKey());

        $user->refresh();
        $this->assertNotNull($user->avatar_path);
        Storage::disk('public')->assertExists((string) $user->avatar_path);
    }

    public function test_user_can_delete_avatar(): void
    {
        $user = User::factory()->create(['username' => 'delete_avatar']);
        $path = 'avatars/'.$user->getKey().'.jpg';
        $user->avatar_path = $path;
        $user->save();
        Storage::disk('public')->put($path, 'fake');

        $token = $user->createToken('t')->plainTextToken;

        $this->deleteJson('/api/user/avatar', [], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('user.avatar_url', null);

        $user->refresh();
        $this->assertNull($user->avatar_path);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_invalid_avatar_type_is_rejected(): void
    {
        $user = User::factory()->create(['username' => 'bad_type']);
        $token = $user->createToken('t')->plainTextToken;

        $file = UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf');

        $this->postJson('/api/user/avatar', ['avatar' => $file], [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnprocessable();
    }
}
