#include <iostream>
#include <vector>
#include <portaudio.h>

const int SAMPLE_RATE = 44100;
const int FRAMES_PER_BUFFER = 256;
const int NUM_CHANNELS = 1;

static int recordCallback(const void *inputBuffer, void *outputBuffer,
                          unsigned long framesPerBuffer,
                          const PaStreamCallbackTimeInfo *timeInfo,
                          PaStreamCallbackFlags statusFlags,
                          void *userData) {
    std::vector<float> *recordedSamples = (std::vector<float> *)userData;
    float *in = (float *)inputBuffer;

    recordedSamples->insert(recordedSamples->end(), in, in + framesPerBuffer * NUM_CHANNELS);
    return paContinue;
}

int main() {
    PaStream *stream;
    PaError err;
    std::vector<float> recordedSamples;

    err = Pa_Initialize();
    if (err != paNoError) {
        std::cerr << "PortAudio error: " << Pa_GetErrorText(err) << std::endl;
        return 1;
    }

    err = Pa_OpenDefaultStream(&stream, NUM_CHANNELS, 0, paFloat32, SAMPLE_RATE,
                               FRAMES_PER_BUFFER, recordCallback, &recordedSamples);
    if (err != paNoError) {
        std::cerr << "PortAudio error: " << Pa_GetErrorText(err) << std::endl;
        return 1;
    }

    err = Pa_StartStream(stream);
    if (err != paNoError) {
        std::cerr << "PortAudio error: " << Pa_GetErrorText(err) << std::endl;
        return 1;
    }

    std::cout << "Recording... Press Enter to stop." << std::endl;
    std::cin.get();

    err = Pa_StopStream(stream);
    if (err != paNoError) {
        std::cerr << "PortAudio error: " << Pa_GetErrorText(err) << std::endl;
    }

    err = Pa_CloseStream(stream);
    if (err != paNoError) {
        std::cerr << "PortAudio error: " << Pa_GetErrorText(err) << std::endl;
    }

    Pa_Terminate();

    // Aquí puedes guardar o transmitir recordedSamples
    std::cout << "Recording finished. Samples recorded: " << recordedSamples.size() << std::endl;
    return 0;
}
